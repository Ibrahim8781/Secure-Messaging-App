const forge = require('node-forge');
const fs = require('fs');

try {
  // Generate a key pair
  console.log('Generating key pair...');
  const keys = forge.pki.rsa.generateKeyPair(2048);

  // Create a certificate
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [{
    name: 'commonName',
    value: 'localhost'
  }];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);

  // Convert to PEM format
  const pemCert = forge.pki.certificateToPem(cert);
  const pemKey = forge.pki.privateKeyToPem(keys.privateKey);

  // Write files
  fs.writeFileSync('server.cert', pemCert);
  fs.writeFileSync('server.key', pemKey);

  console.log('✅ Certificates generated successfully: server.key and server.cert');
} catch (err) {
  console.error('❌ Error generating certificates:', err);
}