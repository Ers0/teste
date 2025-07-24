import React from 'react';
import QRCode from 'react-qr-code';

// Re-export QRCode component
const QRCodeWrapper = (props: React.ComponentProps<typeof QRCode>) => {
  // Pass all props, including the crucial 'id' prop, to the underlying component.
  return <QRCode {...props} />;
};

export default QRCodeWrapper;