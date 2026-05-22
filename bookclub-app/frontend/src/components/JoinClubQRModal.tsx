import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { BookClub } from '../types';
import { 
  XMarkIcon, 
  ClipboardDocumentIcon, 
  ArrowDownTrayIcon, 
  CheckIcon 
} from '@heroicons/react/24/outline';
import { useNotification } from '../contexts/NotificationContext';

interface JoinClubQRModalProps {
  club: BookClub | null;
  onClose: () => void;
}

const JoinClubQRModal: React.FC<JoinClubQRModalProps> = ({ club, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const { addNotification } = useNotification();

  const joinUrl = club 
    ? `${window.location.origin}/clubs/${club.clubId}/join-qr` 
    : '';

  useEffect(() => {
    if (club && canvasRef.current && joinUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        joinUrl,
        {
          width: 256,
          margin: 1,
          color: {
            dark: '#1e1b4b', // Deep indigo instead of plain black for premium feel
            light: '#ffffff',
          },
        },
        (error) => {
          if (error) {
            console.error('Failed to generate QR code:', error);
          }
        }
      );
    }
  }, [club, joinUrl]);

  if (!club) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      addNotification('success', 'Join link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      addNotification('error', 'Failed to copy link');
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const qrCanvas = canvasRef.current;
    const qrSize = qrCanvas.width;

    // Create a high-quality offscreen canvas
    const offCanvas = document.createElement('canvas');
    const padding = 40;
    const textSpace = 100;

    offCanvas.width = qrSize + padding * 2;
    offCanvas.height = qrSize + padding * 2 + textSpace;

    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    // 1. Draw smooth white card background with rounded corners
    ctx.fillStyle = '#ffffff';
    // Draw rounded rect
    const radius = 24;
    const w = offCanvas.width;
    const h = offCanvas.height;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(w - radius, 0);
    ctx.quadraticCurveTo(w, 0, w, radius);
    ctx.lineTo(w, h - radius);
    ctx.quadraticCurveTo(w, h, w - radius, h);
    ctx.lineTo(radius, h);
    ctx.quadraticCurveTo(0, h, 0, h - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.fill();

    // 2. Draw the QR code centered
    ctx.drawImage(qrCanvas, padding, padding);

    // 3. Draw text "Scan the QR code to join the xxx club"
    ctx.fillStyle = '#1e1b4b'; // Deep indigo matching QR color
    ctx.font = 'bold 16px Inter, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const text1 = 'Scan the QR code to join the';
    const text2 = `${club.name} club`;

    // Draw lines
    ctx.fillText(text1, offCanvas.width / 2, qrSize + padding + 35);
    
    // Use slightly different styling or styling emphasizing the club name
    ctx.fillStyle = '#4f46e5'; // Indigo-600 color accent for club name
    ctx.font = 'extrabold 18px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText(text2, offCanvas.width / 2, qrSize + padding + 65);

    // Convert canvas content to data URL and download
    try {
      const dataUrl = offCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      const cleanClubName = club.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      link.download = `${cleanClubName}-join-qr.png`;
      link.href = dataUrl;
      link.click();
      addNotification('success', 'QR code PNG downloaded successfully');
    } catch (err) {
      console.error('Failed to export QR code PNG:', err);
      addNotification('error', 'Failed to download QR code');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop overlay */}
      <div 
        className="absolute inset-0 bg-indigo-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Premium Glassmorphic Modal Card */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-indigo-50/50 p-6 overflow-hidden transform transition-all flex flex-col items-center">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-6 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">
            Share Club Access
          </h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            aria-label="Close modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Club Meta Info */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 mb-2">
            Invite QR Code
          </span>
          <h4 className="text-2xl font-black text-indigo-950 leading-tight">
            {club.name}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Anyone scanning this QR code can request access to join.
          </p>
        </div>

        {/* QR Code Container */}
        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-inner mb-6 relative">
          <canvas 
            ref={canvasRef} 
            className="bg-white p-2 rounded-xl shadow-sm border border-indigo-50"
            style={{ width: '220px', height: '220px' }}
          />
        </div>

        {/* Invite URL Input and Copy Button */}
        <div className="w-full mb-6">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Invitation Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={joinUrl}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-600 focus:outline-none select-all font-mono"
            />
            <button
              onClick={handleCopyLink}
              className={`flex-shrink-0 p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                copied 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100'
              }`}
              title="Copy link"
            >
              {copied ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ClipboardDocumentIcon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-semibold text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-indigo-600/10"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinClubQRModal;
