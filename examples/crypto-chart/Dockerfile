FROM mhart/alpine-node:10
WORKDIR /usr/src
COPY . .
RUN yarn && yarn build

WORKDIR /public
RUN cp -v /usr/src/*.html /usr/src/*.js .
