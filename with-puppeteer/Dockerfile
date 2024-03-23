FROM zenika/alpine-chrome:with-node

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD 1
ENV PUPPETEER_EXECUTABLE_PATH /usr/bin/chromium-browser
# ENV DEBUG puppeteer:*
ENV DEBUG_COLORS true
WORKDIR /usr/cache
WORKDIR /usr/src/app
COPY --chown=chrome package.json  ./
RUN npm install
COPY --chown=chrome . ./
ENTRYPOINT ["tini", "--"]
EXPOSE 4000
CMD ["node", "/usr/src/app/src/app.js"]
