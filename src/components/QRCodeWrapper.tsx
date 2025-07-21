import React from 'react';
import QRCode from 'qrcode.react'; // Attempting default import here

// Re-export QRCode component
const QRCodeWrapper = (props: React.ComponentProps<typeof QRCode>) => {
  return <QRCode {...props} />;
};

export default QRCodeWrapper;