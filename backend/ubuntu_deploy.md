## make sure the follow path is written in index.js in public directory

require('ts-node/register')
require('./server')

## AWS

Instance
Elastic IP
Router 53 create record for subdomain (A Record)

### To Deploy

Linkup to serve

chmod 400 bigcstaffportal.pem
<!-- ssh -i bigcstaffportal.pem ubuntu@3.1.139.29 -->
ssh -i "bigcstaffportal.pem" ubuntu@ec2-3-1-139-29.ap-southeast-1.compute.amazonaws.com
hostname
sudo hostnamectl set-hostname postgresql-server

## Update Advanced package tool

sudo apt update -y && sudo apt full-upgade -y

## install postgres
sudo apt install postgresql -y
sudo -i -u postgres

## system administration and install database
psql
create user admin with password 'admin' superuser;
create database staffportal;
\c staffportal
grant all privileges on database staffportal to admin;
\q
exit

## install nodejs
nodejs on ubuntu: https://github.com/nodesource/distributions/blob/master/README.md
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - &&\
sudo apt-get install -y nodejs

## Generate Key

ssh-keygen -t rsa

## Get Key

cat ~/.ssh/id_rsa.pub

<!--
copy the key and palse it into Setting  => Deploy keys/ Add New
unclick the "Allow write access" then "Add key"
git clone
-->

## update .env

vi .env
DB_NAME = staffportal
DB_USER = admin
DB_PASSWORD = admin
:wq

## install nginx

sudo apt update
sudo apt install nginx

## change port settings

cd /
ls
sudo vi /etc/nginx/sites-enabled/default

server_name => abundance.ink;

location / {
proxy_pass http://localhost:1840;
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_set_header Host $host;
proxy_cache_bypass $http_upgrade;
}

## change settings
cd /etc/postgresql/16/main
sudo vi postgresql.conf
change listening from 'localhost' to '*'
:x

sudo vi pg_hba.conf
host    all             all             0.0.0.0/0   md5

sudo service postgresql restart
sudo systemctl restart postgresql
sudo service postgresql status

sudo -i -u postgres

psql

\l

# Create Certificate

sudo apt-get install python3-certbot-nginx
sudo certbot --nginx

# Restart NginX Server

sudo service nginx restart

# install NPM

sudo apt install npm

## make it forever start

sudo npm install -g forever
forever start server.js

## use sql on remote server

psql -U admin -W -h localhost < db.sql

## force stop server

forever stop 0
ps aux | grep npm
kill 5773
kill 5785

## Restall data

ssh -i weddingexpert.pem ubuntu@18.143.39.56

git pull git@github.com:imjasonkam/ywp.git

forever stop 0

sudo su postgres
psql
drop database home;
create database home;
\q
exit

npx knex migrate:latest
npx knex seed:run

forever start index.js

## React Build S3

REACT_APP_BACKEND_URL=https://wedding-server.emperor9.me yarn build
