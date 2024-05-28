FROM litestream/litestream:0.3.13

RUN apk update && apk add --no-cache curl

COPY install-ytt.sh /install-ytt.sh
RUN /install-ytt.sh && rm /install-ytt.sh

COPY litestream.template.yaml .
COPY docker-entrypoint.sh .

RUN chmod 755 /docker-entrypoint.sh

ENTRYPOINT [ "./docker-entrypoint.sh" ]
