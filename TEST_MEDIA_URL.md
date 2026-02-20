# Teste de Acessibilidade da URL de Mídia

## Problema Atual

A Meta API está rejeitando o template com erro:
> "Modelos com o tipo de cabeçalho IMAGE precisam de um exemplo/modelo, mas não foi fornecido"

Mesmo que o payload esteja correto com `example.header_handle` presente, isso indica que **a Meta não consegue acessar a URL da mídia**.

## URL Sendo Testada

```
https://back.mibiadigital.com.br/public/template-media/2/template_1765494482956_c3x3vs.png
```

## Testes Necessários

### 1. Teste Local (do servidor)

```bash
# No servidor onde está o backend
curl -I https://back.mibiadigital.com.br/public/template-media/2/template_1765494482956_c3x3vs.png

# Deve retornar:
# HTTP/2 200
# content-type: image/png
# content-length: XXXXX
```

### 2. Teste Externo (de fora do servidor)

**Opção A - Navegador**:
1. Abra em uma aba anônima: `https://back.mibiadigital.com.br/public/template-media/2/template_1765494482956_c3x3vs.png`
2. A imagem deve carregar normalmente

**Opção B - Ferramenta Online**:
1. Acesse: https://reqbin.com/
2. Cole a URL
3. Clique em "Send"
4. Deve retornar status 200

**Opção C - Curl de outro servidor**:
```bash
# De outro servidor/máquina
curl -I https://back.mibiadigital.com.br/public/template-media/2/template_1765494482956_c3x3vs.png
```

### 3. Teste de DNS

```bash
# Verificar se DNS resolve corretamente
nslookup back.mibiadigital.com.br

# Verificar de DNS público (Google)
nslookup back.mibiadigital.com.br 8.8.8.8
```

## Possíveis Problemas

### Problema 1: Firewall Bloqueando

**Sintoma**: Funciona localmente mas não externamente

**Solução**:
```bash
# Verificar firewall
sudo ufw status

# Permitir porta 443 (HTTPS)
sudo ufw allow 443/tcp

# Verificar nginx
sudo nginx -t
sudo systemctl status nginx
```

### Problema 2: Nginx Não Serve Arquivos Estáticos

**Sintoma**: 404 ou 403 ao acessar a URL

**Solução - Configurar Nginx**:
```nginx
server {
    listen 443 ssl http2;
    server_name back.mibiadigital.com.br;

    # ... outras configurações SSL ...

    # ✅ Servir arquivos estáticos
    location /public/ {
        alias /caminho/para/backend/public/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
        
        # Permitir acesso externo
        allow all;
    }

    # Proxy para backend
    location / {
        proxy_pass http://localhost:8080;
        # ... outras configurações proxy ...
    }
}
```

Reiniciar nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Problema 3: Permissões de Arquivo

**Sintoma**: 403 Forbidden

**Solução**:
```bash
# Verificar permissões
ls -la /caminho/para/backend/public/template-media/2/

# Corrigir permissões
sudo chown -R www-data:www-data /caminho/para/backend/public/
sudo chmod -R 755 /caminho/para/backend/public/
```

### Problema 4: DNS Interno

**Sintoma**: Resolve para IP privado (10.x, 172.x, 192.168.x)

**Solução**: Configurar DNS público corretamente no domínio

### Problema 5: Certificado SSL Inválido

**Sintoma**: Erro SSL ao acessar

**Solução**:
```bash
# Verificar certificado
sudo certbot certificates

# Renovar se necessário
sudo certbot renew

# Verificar validade online
# https://www.ssllabs.com/ssltest/analyze.html?d=back.mibiadigital.com.br
```

## Teste Rápido - Comando Único

Execute este comando **de outro servidor ou máquina**:

```bash
curl -v https://back.mibiadigital.com.br/public/template-media/2/template_1765494482956_c3x3vs.png -o /tmp/test.png && file /tmp/test.png
```

**Resultado esperado**:
```
< HTTP/2 200
< content-type: image/png
...
/tmp/test.png: PNG image data, 800 x 600, 8-bit/color RGB, non-interlaced
```

**Se falhar**:
- Verifique firewall
- Verifique nginx
- Verifique DNS
- Verifique certificado SSL

## Solução Temporária - Usar CDN

Se não conseguir resolver o problema de acessibilidade, use um CDN temporário:

### Opção 1: Cloudflare (Gratuito)

1. Adicione domínio ao Cloudflare
2. Configure DNS
3. Ative proxy (nuvem laranja)
4. Cloudflare servirá os arquivos

### Opção 2: AWS S3 + CloudFront

```bash
# Upload para S3
aws s3 cp /caminho/arquivo.png s3://seu-bucket/template-media/ --acl public-read

# URL pública
https://seu-bucket.s3.amazonaws.com/template-media/arquivo.png
```

### Opção 3: Imgur (Temporário para testes)

1. Acesse: https://imgur.com/upload
2. Faça upload da imagem
3. Copie link direto (termina em .png)
4. Use no template

## Verificação Final

Depois de corrigir, teste novamente:

1. **Reinicie api-oficial**:
```bash
pm2 restart api-oficial
```

2. **Tente criar o template novamente**

3. **Verifique os logs**:
```bash
pm2 logs api-oficial --lines 50 | grep "CREATE TEMPLATE"
```

Deve mostrar:
```
[CREATE TEMPLATE] ✅ Mídia validada e acessível
[CREATE TEMPLATE] Content-Type: image/png
[CREATE TEMPLATE] Enviando para Meta API...
[META] ✅ Template criado com sucesso
```

## Checklist de Diagnóstico

- [ ] URL acessível localmente (curl do servidor)
- [ ] URL acessível externamente (navegador anônimo)
- [ ] DNS resolve corretamente
- [ ] Certificado SSL válido
- [ ] Firewall permite porta 443
- [ ] Nginx configurado para servir /public/
- [ ] Permissões de arquivo corretas (755)
- [ ] Content-Type correto (image/png)
- [ ] Arquivo existe e não está corrompido

## Próximos Passos

1. Execute os testes acima
2. Identifique qual está falhando
3. Aplique a correção correspondente
4. Teste novamente a criação do template
5. Se ainda falhar, considere usar CDN temporário
