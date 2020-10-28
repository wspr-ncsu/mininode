FROM mininode

ARG redis
ARG mongo
ARG local_npm

RUN mkdir /packages /archives

ENV REDIS $redis
ENV MONGO  $mongo
ENV LOCALNPM $local_npm
ENV QUEUE npm-full
ENV MONGO_DB npm-measurement
ENV SOFT_COLLECTION coarse
ENV HARD_COLLECTION fine
ENV STAGE install

WORKDIR /mn
COPY ./mn /mn
RUN npm install --production

WORKDIR /app
COPY ./src /app
RUN npm install --production

CMD ["node", "/app"]