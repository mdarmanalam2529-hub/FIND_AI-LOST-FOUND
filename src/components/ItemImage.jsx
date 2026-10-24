import React, { useState, useEffect } from 'react';
import { itemsService } from '../services/itemsService';
import { ImageIcon, Loader2 } from 'lucide-react';

export default function ItemImage({ imagePath, alt = 'Item photo', className = '', style = {}, onClick = null }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(Boolean(imagePath));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;

    if (!imagePath) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFailed(false);

    itemsService
      .getSignedImageUrl(imagePath, 3600) // 1-hour signed URL
      .then((url) => {
        if (!isMounted) return;
        if (url) {
          setSignedUrl(url);
        } else {
          setFailed(true);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('[ItemImage] Failed to get signed URL:', err);
        setFailed(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [imagePath]);

  if (!imagePath || failed) {
    return (
      <div 
        style={{ 
          width: '100%', 
          height: '140px', 
          background: 'var(--bg-subtle)', 
          borderBottom: '1px solid var(--border-subtle)', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '0.4rem',
          color: 'var(--text-muted)',
          ...style
        }}
        className={className}
      >
        <ImageIcon size={22} color="var(--text-dim)" />
        <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>No photograph provided</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div 
        style={{ 
          width: '100%', 
          height: '140px', 
          background: 'var(--bg-subtle)', 
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'var(--primary)',
          ...style
        }}
        className={className}
      >
        <Loader2 size={20} className="spin" />
      </div>
    );
  }

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '160px', 
        overflow: 'hidden', 
        position: 'relative', 
        background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: onClick ? 'pointer' : 'default',
        ...style 
      }}
      onClick={onClick ? () => onClick(signedUrl) : undefined}
      className={className}
      title={onClick ? 'Click to enlarge' : undefined}
    >
      <img
        src={signedUrl}
        alt={alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transition: 'transform 0.25s ease',
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
