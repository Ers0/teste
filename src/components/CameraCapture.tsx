import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { showError } from '@/utils/toast';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const videoElement = videoRef.current;

    const startCamera = async () => {
      if (videoElement) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          videoElement.srcObject = stream;
          videoElement.play();
        } catch (err) {
          console.error("Error accessing camera:", err);
          showError(t('error_accessing_camera'));
          onClose();
        }
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, [onClose, t]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

        canvas.toBlob((blob) => {
          if (blob) {
            const photoFile = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onCapture(photoFile);
          }
        }, 'image/jpeg');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black bg-opacity-80 p-4">
      <h2 className="text-2xl font-bold text-white mb-4">{t('take_photo')}</h2>
      <div className="relative w-full max-w-2xl">
        <video ref={videoRef} autoPlay playsInline className="w-full h-auto rounded-md aspect-video object-cover bg-black"></video>
        <canvas ref={canvasRef} className="hidden"></canvas>
      </div>
      <div className="flex gap-4 mt-4">
        <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
        <Button onClick={handleCapture}>{t('capture_photo')}</Button>
      </div>
    </div>
  );
};

export default CameraCapture;