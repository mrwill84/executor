export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
docker build -t chromeless:latest -f ./with-puppeteer/Dockerfile ./with-puppeteer/

 
address="8.217.27.17"
echo $address


docker save --output chromeless.tar chromeless && \
scp  chromeless.tar root@$address:/root/openworld  && \
rm chromeless.tar
# docker run -it --rm -v /Users/zilly-a04-015/team-project/carbon/scraper/alpine-chrome/with-puppeteer/src:/usr/src/app/src --cap-add=SYS_ADMIN chromeless:latest node src/screenshot-asia.js
#node src/amz.js