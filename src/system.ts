/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { getContractState } from './api/warp';
import { prefetchContractTxIds } from './config';
import logger from './logger';
import { warp } from './middleware';
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'node:fs';
import { Readable } from 'stream';
import path from 'node:path';
import {
  BOOTSTRAP_CACHE,
  PREFETCH_CONTRACTS,
  SAVE_CACHE_TO_S3,
} from './constants';
import pLimit from 'p-limit';

const bucket = process.env.WARP_CACHE_BUCKET || 'arns-warp-cache';
const cacheDirectory = process.env.WARP_CACHE_KEY || 'cache';
const region = process.env.AWS_REGION || 'us-west-2';
const s3CacheIntervalMs = +(
  process.env.S3_CACHE_INTERVAL_MS || 3 * 60 * 60 * 1000
);
const s3 = new S3Client({
  region,
});

export const bootstrapCache = async () => {
  if (BOOTSTRAP_CACHE) {
    await fetchCacheFromS3();
  }

  if (PREFETCH_CONTRACTS) {
    await prefetchContracts();
  }

  if (SAVE_CACHE_TO_S3) {
    // save the cache on a 3 hour interval
    setInterval(saveCacheToS3, s3CacheIntervalMs);
  }
};

let successfullyPrefetchedContracts = false;
export const getPrefetchStatusCode = () => {
  if (!PREFETCH_CONTRACTS) {
    return 200;
  }
  return successfullyPrefetchedContracts ? 200 : 503;
};

export const prefetchContracts = async () => {
  const startTimeMs = Date.now();
  logger.info('Pre-fetching contracts...', {
    contractTxIds: prefetchContractTxIds,
  });
  // don't wait - just fire and forget
  const prefetchResults = await Promise.all(
    prefetchContractTxIds.map((contractTxId: string) => {
      const startTimestamp = Date.now();
      logger.info('Pre-fetching contract state...', {
        contractTxId,
        startTimestamp,
      });
      return getContractState({
        contractTxId,
        warp,
        logger: logger.child({ prefetch: true }),
      })
        .then(() => {
          const endTimestamp = Date.now();
          logger.info('Successfully prefetched contract state', {
            contractTxId,
            durationMs: endTimestamp - startTimestamp,
          });
          return true;
        })
        .catch((error: unknown) => {
          const endTimestamp = Date.now();
          const message = error instanceof Error ? error.message : error;
          logger.error('Failed to prefetch contract state', {
            error: message,
            contractTxId,
            stack: error instanceof Error ? error.stack : undefined,
            durationMs: endTimestamp - startTimestamp,
          });
          // don't fail the entire prefetch operation if one contract fails
          return true;
        });
    }),
  ).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : error;
    logger.error('Failed to prefetch all contracts', {
      error: message,
      contractTxIds: prefetchContractTxIds,
    });
    // fail if anything throws
    return [false];
  });
  // update our healthcheck flag
  successfullyPrefetchedContracts = prefetchResults.every(
    (result) => result === true,
  );
  logger.info('Finished pre-fetching contracts', {
    success: successfullyPrefetchedContracts,
    contractTxIds: prefetchContractTxIds,
    durationMs: Date.now() - startTimeMs,
  });
};

export const fetchCacheFromS3 = async () => {
  const startTimeMs = Date.now();
  const params = {
    Bucket: bucket,
    Key: cacheDirectory,
  };

  logger.info('Bootstrapping warp cache from S3', {
    params,
  });

  try {
    const data = await s3.send(new ListObjectsV2Command(params));

    for (const obj of data.Contents || []) {
      const fileKey = obj.Key;
      if (!fileKey) {
        continue;
      }

      const tempFilePath = path.join(
        process.cwd(),
        fileKey.replace(params.Key, 'tmp'),
      );

      const tmpFileDir = path.dirname(tempFilePath);

      await fs.promises.mkdir(tmpFileDir, { recursive: true });

      const data = await s3.send(
        new GetObjectCommand({ ...params, Key: fileKey }),
      );

      logger.debug('Saving cache to temp file', {
        fileKey,
        tempFilePath,
      });

      if (data.Body) {
        const readableStream = data.Body as Readable;
        await fs.promises.writeFile(tempFilePath, readableStream);
        logger.debug('Successfully saved file to local filesystem', {
          fileKey,
          tempFilePath,
        });
        const warpCacheDir = path.dirname(fileKey);
        await fs.promises.mkdir(warpCacheDir, { recursive: true });
        if (fs.existsSync(fileKey)) {
          await fs.promises.unlink(fileKey);
        }
        // moves the file from the temp location to the final location
        await fs.promises.rename(tempFilePath, fileKey);
      }
    }
    logger.info('Successfully bootstrapped warp cache from S3', {
      durationMs: Date.now() - startTimeMs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to bootstrap cache from S3', {
      error: message,
    });
  }
};

export const saveCacheToS3 = async () => {
  const startTimeMs = Date.now();

  logger.info('Saving warp cache to S3', {
    bucket,
  });

  try {
    // read files from local file system
    const parallelLimit = pLimit(10);
    const uploadFolder = async ({
      folderPath,
      bucket,
      keyPrefix,
    }: {
      folderPath: string;
      bucket: string;
      keyPrefix: string;
    }) => {
      const files = fs.readdirSync(folderPath);
      await Promise.all(
        files.map(async (file) => {
          // wrap in a pLimit to avoid resource exhaustion
          return parallelLimit(() => {
            const filePath = path.join(folderPath, file);
            if (fs.statSync(filePath).isFile()) {
              logger.debug('Uploading file to S3', {
                filePath,
                bucket,
                keyPrefix,
              });
              const fileStream = fs.createReadStream(filePath);
              const key = path.basename(filePath);
              const upload = new Upload({
                client: s3,
                params: {
                  Bucket: bucket,
                  Key: key,
                  Body: fileStream,
                },
              });

              // catch errors for a single file
              return upload.done().catch((error: unknown) => {
                const message =
                  error instanceof Error ? error : new Error('Unknown error');
                logger.error('Failed to upload file to S3', {
                  error: message,
                  file,
                });
              });
            } else {
              // recursively upload folders
              return uploadFolder({
                folderPath,
                bucket,
                keyPrefix: keyPrefix + file + '/',
              });
            }
          });
        }),
      );
    };

    // upload files to S3 recursively and in a pLimit to avoid resource exhaustion
    await uploadFolder({
      folderPath: cacheDirectory,
      bucket,
      keyPrefix: '',
    });

    logger.info('Successfully saved warp cache to S3', {
      durationMs: Date.now() - startTimeMs,
      bucket,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error : new Error('Unknown error');
    logger.error('Failed to save cache to S3', {
      error: message,
    });
  }
};
