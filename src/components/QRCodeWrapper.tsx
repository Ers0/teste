import React from 'react';
import QRCode from 'react-qr-code';

// This wrapper is needed to resolve a TypeScript type conflict in the `react-qr-code` library.
// The library's props have a `ref` type for an SVGElement, but since it's a class component,
// React expects a `ref` for the component instance, causing a type error.
// By destructuring the `ref` out and not passing it, we avoid the conflict.
const QRCodeWrapper = (props: React.ComponentProps<typeof QRCode>) => {
  // The `ref` is destructured from props and not passed down to avoid the type error.
  // The `ref` variable itself is not used.
  const { ref, ...rest } = props;
  return <QRCode {...rest} />;
};

export default QRCodeWrapper;