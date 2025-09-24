// Wrapper to lock the Hostinger deploy destination for production
process.env.DEPLOY_DEST = process.env.DEPLOY_DEST || 'domains/thechurchofunity.com/public_html';
import './deploy-sftp.mjs';

