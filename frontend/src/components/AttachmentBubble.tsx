import { useState, useEffect } from 'react';
import type { AttachmentMetadata } from '../store/useStore';
import { decryptFile, importAESKey } from '../lib/crypto';
import { useStore } from '../store/useStore';
import { Download, File, X, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

interface Props {
  attachment: AttachmentMetadata;
  roomId: string;
}

export function AttachmentBubble({ attachment, roomId }: Props) {
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [decryptedBlob, setDecryptedBlob] = useState<Blob | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const { sessionKeyBase64, sessionId } = useStore();

  const isImage = attachment.mime.startsWith('image/');

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const handleDownload = async () => {
    if (!sessionKeyBase64 || !sessionId) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    const controller = new AbortController();
    setAbortController(controller);

    try {
      const API_URL = import.meta.env.VITE_API_URL || '';
      const response = await axios.get(
        `${API_URL}/api/room/${roomId}/attachments/${attachment.id}?session_id=${sessionId}`,
        {
          responseType: 'arraybuffer',
          signal: controller.signal,
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setDownloadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
            }
          },
        }
      );

      const cryptoKey = await importAESKey(sessionKeyBase64);
      const decryptedBuffer = await decryptFile(cryptoKey, attachment.iv, response.data);
      const blob = new Blob([decryptedBuffer], { type: attachment.mime });
      
      setDecryptedBlob(blob);
      setObjectUrl(URL.createObjectURL(blob));
      setIsDownloading(false);
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Download canceled');
      } else {
        console.error('Download failed', error);
        alert('Failed to download or decrypt file.');
      }
      setIsDownloading(false);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (decryptedBlob && objectUrl) {
    if (isImage) {
      return (
        <div className="mt-2 rounded-lg overflow-hidden border border-gray-700/50">
          <img src={objectUrl} alt={attachment.name} className="max-w-full h-auto max-h-64 object-contain" />
          <a href={objectUrl} download={attachment.name} className="block w-full text-center py-2 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 transition-colors">
            Download Original ({formatSize(attachment.size)})
          </a>
        </div>
      );
    }
    
    return (
      <div className="mt-2 flex items-center justify-between p-3 bg-gray-800/80 rounded-lg border border-gray-700/50">
        <div className="flex items-center gap-3">
          <File className="w-8 h-8 text-cyan-400" />
          <div>
            <p className="text-sm font-medium text-gray-200 truncate max-w-[150px] sm:max-w-[200px]" title={attachment.name}>{attachment.name}</p>
            <p className="text-xs text-gray-400">{formatSize(attachment.size)} • Ready</p>
          </div>
        </div>
        <a href={objectUrl} download={attachment.name} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-full hover:bg-emerald-500/30 transition-colors">
          <Download className="w-4 h-4" />
        </a>
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30 w-full sm:min-w-[250px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isImage ? <ImageIcon className="w-8 h-8 text-gray-500" /> : <File className="w-8 h-8 text-gray-500" />}
          <div>
            <p className="text-sm font-medium text-gray-300 truncate max-w-[120px] sm:max-w-[180px]">{attachment.name}</p>
            <p className="text-xs text-gray-500">{formatSize(attachment.size)}</p>
          </div>
        </div>
        
        {!isDownloading ? (
          <button onClick={handleDownload} className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors">
            <Download className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleCancel} className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {isDownloading && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Decrypting...</span>
            <span>{downloadProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
