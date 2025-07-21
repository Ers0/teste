import React from 'react';
import QRCode from 'react-qr-code'; // Importing the new library

// Re-export QRCode component
const QRCodeWrapper = (props: React.ComponentProps<typeof QRCode>) => {
  // react-qr-code uses 'value' for the QR code data and 'size' for dimensions.
  // 'level' (error correction) is also supported. 'includeMargin' is not a direct prop.
  return <QRCode value={props.value} size={props.size} level={props.level} />;
};

export default QRCodeWrapper;