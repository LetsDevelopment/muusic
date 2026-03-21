# Migracao de VPS - `muusic.live`

Origem atual: `92.113.34.116`
Destino novo: `72.60.9.200`
Dominio principal: `muusic.live`

Este playbook assume:
- SO da nova VPS: Ubuntu
- Deploy continua via GitHub Actions + SSH
- Processo continua em `pm2`
- Reverse proxy continua em `nginx`
- Redis continua externo
- PostgreSQL sera migrado da VPS antiga para a nova VPS

## 1. Descoberta na VPS antiga

Rodar na VPS antiga para confirmar estado atual antes de mexer:

```bash
hostname
uname -a
pm2 list
nginx -T | sed -n '1,220p'
systemctl status nginx --no-pager
systemctl status postgresql --no-pager
psql --version
node -v
npm -v
```

Confirmar onde o app esta publicado:

```bash
ls -la /var/www
ls -la /var/www/muusic2.0
```

Confirmar arquivos locais que devem ser preservados:

```bash
find /var/www/muusic2.0/server/data -maxdepth 2 -type f | sort
ls -la /var/www/muusic2.0/.env.production
```

Observacao:
- Pelo codigo atual, o diretorio local conhecido e `server/data/`.
- Nao existe evidencia de diretoria de upload dedicada no repo. Avatares parecem ser gravados no banco.

## 2. Preparar a nova VPS

Rodar na nova VPS:

```bash
apt update
apt install -y nginx git curl ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs postgresql postgresql-contrib
npm i -g pm2
```

Se o projeto usa PostGIS, instalar tambem:

```bash
apt install -y postgis postgresql-16-postgis-3
```

Criar estrutura de deploy:

```bash
mkdir -p /var/www
cd /var/www
git clone <REPO_GIT> muusic2.0
cd /var/www/muusic2.0
```

## 3. Criar PostgreSQL na nova VPS

Criar usuario e banco. Ajustar senha forte:

```bash
sudo -u postgres psql
CREATE USER muusic2 WITH PASSWORD 'TROCAR_SENHA_FORTE';
CREATE DATABASE muusic2 OWNER muusic2;
\c muusic2
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

Definir `DATABASE_URL` em `.env.production`:

```bash
DATABASE_URL=postgresql://muusic2:TROCAR_SENHA_FORTE@127.0.0.1:5432/muusic2?schema=public
```

## 4. Copiar configuracao de producao

Na VPS antiga, revisar o arquivo real:

```bash
cat /var/www/muusic2.0/.env.production
```

Na VPS nova, criar o equivalente:

```bash
cp /var/www/muusic2.0/.env.production.example /var/www/muusic2.0/.env.production
nano /var/www/muusic2.0/.env.production
```

Valores que precisam ser confirmados no destino:
- `PORT=3001`
- `FRONTEND_URL=https://muusic.live`
- `FRONTEND_URLS=...`
- `DATABASE_URL=postgresql://...`
- `REDIS_URL=...` apontando para o Redis externo
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI=https://muusic.live/auth/spotify/callback`
- `SPOTIFY_JWT_SECRET`
- `VITE_API_URL=https://muusic.live`
- `VITE_MAPBOX_TOKEN`

Ponto de atencao:
- O exemplo ainda cita `painel.muusic.live`. Se esse host nao existir mais, remover de `FRONTEND_URLS`.

## 5. Migrar banco de dados

Na VPS antiga, descobrir nome do banco caso ainda nao esteja fechado:

```bash
sudo -u postgres psql -lqt
```

Gerar dump consistente na VPS antiga:

```bash
sudo -u postgres pg_dump -Fc <NOME_DO_BANCO> > /root/muusic2-db.dump
ls -lh /root/muusic2-db.dump
```

Copiar o dump para a nova VPS:

```bash
scp /root/muusic2-db.dump root@72.60.9.200:/root/
```

Restaurar na nova VPS:

```bash
sudo -u postgres pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --dbname=muusic2 \
  /root/muusic2-db.dump
```

Se o banco antigo usar outro owner, pode ser necessario:

```bash
sudo -u postgres psql -d muusic2 -c "ALTER SCHEMA public OWNER TO muusic2;"
```

## 6. Migrar arquivos locais

Copiar ao menos:
- `/var/www/muusic2.0/server/data/`
- `.env.production` se quiser reaproveitar a base

Da VPS antiga para a nova:

```bash
scp -r /var/www/muusic2.0/server/data root@72.60.9.200:/var/www/muusic2.0/server/
```

Se preferir copiar tudo que nao esta no git para inspecao:

```bash
rsync -avz /var/www/muusic2.0/server/data/ root@72.60.9.200:/var/www/muusic2.0/server/data/
```

## 7. Build e primeira subida na nova VPS

Na nova VPS:

```bash
cd /var/www/muusic2.0
npm ci
npm run prisma:generate
npm run db:migrate
npm run build
pm2 start ecosystem.config.cjs --env production
pm2 save
```

Validar backend local:

```bash
curl -I http://127.0.0.1:3001/health
pm2 logs muusic2 --lines 100
```

## 8. Configurar nginx na nova VPS

Criar `/etc/nginx/sites-available/muusic2.0`:

```nginx
server {
  server_name muusic.live;

  root /var/www/muusic2.0/dist;
  index index.html;

  location /socket.io/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }

  location /auth/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /admin/ {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /health {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

Ativar:

```bash
ln -s /etc/nginx/sites-available/muusic2.0 /etc/nginx/sites-enabled/muusic2.0
nginx -t
systemctl reload nginx
```

## 9. Validacao antes da virada de DNS

Na nova VPS:

```bash
curl -I http://127.0.0.1:3001/health
curl -I http://127.0.0.1
```

De fora da VPS, testar por IP e `Host` manual:

```bash
curl -I http://72.60.9.200 -H 'Host: muusic.live'
curl https://72.60.9.200/health -k -H 'Host: muusic.live'
```

Itens para validar:
- pagina inicial abre
- `/health` responde
- login local funciona
- rotas `/api` funcionam
- conexao com Redis externo funciona
- WebSocket conecta

## 10. Virada

Ordem recomendada para reduzir risco:

1. Parar a app antiga:

```bash
pm2 stop muusic2
pm2 save
```

2. Ajustar Cloudflare:
- Atualizar o registro `A` de `muusic.live` para `72.60.9.200`
- Manter proxy do Cloudflare conforme estrategia escolhida

3. Confirmar que a nova VPS esta online:

```bash
pm2 list
curl -I http://127.0.0.1:3001/health
```

4. Testar o dominio publico:

```bash
curl -I https://muusic.live
```

## 11. GitHub Actions

Atualizar os secrets do repositrio:
- `VPS_HOST=72.60.9.200`
- `VPS_USER=root` ou usuario dedicado
- `VPS_PORT=22`
- `VPS_SSH_KEY=<chave da nova VPS>`

Observacao:
- O workflow do repo esta em modo manual no momento. Antes de religar deploy automatico, validar a nova VPS primeiro.

## 12. Rollback

Se a virada falhar:

1. Reapontar Cloudflare para `92.113.34.116`
2. Subir novamente o app antiga:

```bash
pm2 start muusic2
pm2 save
```

3. Confirmar resposta:

```bash
curl -I http://127.0.0.1:3001/health
```

## 13. Pendencias em aberto

Ainda precisam ser confirmados:
- Nome real do banco na VPS antiga
- Se `muusic.live` e o unico host ativo
- Janela de downtime aceitavel
- Data desejada da virada

## 14. Validacao do deploy automatico

Depois de atualizar os secrets do GitHub Actions para a nova VPS, um push simples na `main` deve:
- conectar por SSH em `72.60.9.200`
- rodar `./scripts/deploy_vps.sh main`
- reconstruir o frontend
- recarregar o processo `muusic2` no `pm2`

Checks recomendados apos o workflow:
- `pm2 list`
- `curl -I http://127.0.0.1:3001/health`
- `curl -I https://muusic.live`
- `curl -I https://muusic.live/health`

Observacao:
- O repositorio agora tem uma migration inicial para bootstrap de banco vazio.
- O fallback para `prisma db push` em `scripts/deploy_vps.sh` existe apenas para ambientes legados que ficaram com historico inconsistente de migrations.
- O smoke test detecta `painel.muusic.live` automaticamente quando esse host estiver presente em `FRONTEND_URLS` do `.env`.
