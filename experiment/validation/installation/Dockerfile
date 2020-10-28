FROM mininode

ARG redis
ARG mongo
ARG local_npm

ENV REDIS $redis
ENV MONGO $mongo
ENV MONGO_DB npm-validation
ENV MONGO_COLLECTION installs
ENV QUEUE npm-validation
ENV LOCALNPM $local_npm

RUN mkdir /mn-packages /mn-archives
COPY ./linters /linters

WORKDIR /app
COPY ./src /app
RUN npm install --production

CMD ["node", "/app"]