# Adjust however necessary depending on your machine

FROM node:18.14.0

ENV DEBIAN_FRONTEND=noninteractive

# ADD ./mininode/ /mininode/

WORKDIR /

COPY ./ ./

RUN npm install

USER node

ENTRYPOINT /bin/bash