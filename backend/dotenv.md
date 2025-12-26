# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=staffportal
DB_USER=admin
DB_PASSWORD=admin

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024
JWT_EXPIRES_IN=3h

# Server Configuration
PORT=8080
NODE_ENV=development

# Allowed Origins
ALLOWED_ORIGINS=http://bigchkstaffportal.s3-website-ap-southeast-1.amazonaws.com
<!-- CLOUDFRONT_URL=http://d1plg781uxznov.cloudfront.net -->

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Gmail OAuth2 Configuration
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_USER_EMAIL=
