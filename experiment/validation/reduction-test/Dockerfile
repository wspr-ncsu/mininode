FROM mininode

ARG redis
ARG mongo
ARG local_npm

RUN apt-get install -y rsync
RUN npm install -g complexity-report

RUN mkdir /mn-packages /mn-archives /mn-tests /mn-todos /mn-archives-prod
COPY ./linters /linters

WORKDIR /mn
COPY ./mn .
RUN npm install --production

WORKDIR /app
COPY ./src /app
RUN npm install --production

ENV REDIS $redis
ENV MONGO  $mongo
ENV MONGO_DB npm-validation
ENV LOCALNPM $local_npm

# should be updated in pod.yaml file to specify specific mininode mode to run
ENV MONGO_COLLECTION fine-grain
ENV QUERY npm-fine-grain
ENV MODE hard 

CMD ["node", "/app"]