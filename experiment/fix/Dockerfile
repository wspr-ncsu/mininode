FROM mininode

ARG redis
ARG mongo
ARG local_npm
RUN mkdir /packages /archives

ENV REDIS $redis
ENV MONGO  $mongo
ENV LOCALNPM $local_npm
ENV QUEUE npm-fix
ENV MONGO_DB npm-measurement
ENV SOFT_COLLECTION coarse
ENV STAGE install

WORKDIR /app
COPY ./src /app
RUN npm install --production

CMD ["node", "/app"]