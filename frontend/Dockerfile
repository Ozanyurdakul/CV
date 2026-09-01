FROM nginx:alpine

# Varsayılan nginx konfigürasyonunu silip bizimkini koyuyoruz
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Statik dosyaları (index.html ve resimler) nginx'in yayın klasörüne kopyalıyoruz
COPY index.html /usr/share/nginx/html/
COPY bg.png /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
