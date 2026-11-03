FROM node:22.22.3-bookworm-slim

ARG VSCODE_VERSION=1.144.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl xvfb xauth libasound2 libgbm1 \
    && curl --fail --location --retry 3 "https://update.code.visualstudio.com/${VSCODE_VERSION}/linux-deb-$(dpkg --print-architecture)/stable" -o /tmp/code.deb \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends /tmp/code.deb \
    && rm -rf /var/lib/apt/lists/* /tmp/code.deb

WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json .nvmrc .npmrc ./
COPY --chown=node:node helpers ./helpers
RUN npm ci
COPY --chown=node:node . .

ENV CONFIG_LINT_CONTAINER=1
CMD ["xvfb-run", "-a", "npm", "run", "test:int:headed"]
