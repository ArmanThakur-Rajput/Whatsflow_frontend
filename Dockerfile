# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# package files copy karo (node_modules zip mein hain but fresh install better hai)
COPY package.json ./

# Dependencies install karo
RUN npm install --legacy-peer-deps

# Baaki saara source copy karo
COPY . .

# .env file mein API URL already set hai — agar override karna ho to
# build time ARG use karo:
ARG EXPO_PUBLIC_API_URL
RUN if [ -n "$EXPO_PUBLIC_API_URL" ]; then \
      echo "EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL" > .env; \
    fi

# Expo web build karo (dist/ folder mein output aayega)
RUN npx expo export --platform web

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:alpine

# Expo export ka output copy karo
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA routing ke liye nginx config — sabhi routes index.html par redirect honge
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Gzip compression\n\
    gzip on;\n\
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # Static assets cache\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
