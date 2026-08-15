'use client';

import React, { useState } from 'react';
import { useTheme, useMaxHeight, useWidgetSDK } from '@nitrostack/widgets';
import { Search, ChevronLeft, ChevronRight, Inbox, RefreshCw } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ListWidgetItem {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    type?: 'success' | 'warning' | 'info' | 'error' | 'neutral';
  };
  details: Array<{
    label: string;
    value: string | number;
  }>;
}

interface ListWidgetData {
  title: string;
  subtitle?: string;
  items: ListWidgetItem[];
}

export default function ListWidget() {
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const isDark = theme === 'dark';
  const { isReady, getToolOutput } = useWidgetSDK();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const data = getToolOutput<ListWidgetData>();

  if (!data) {
    return (
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: isDark ? '#f8fafc' : '#0f172a',
        background: isDark ? '#0f172a' : '#f8fafc',
        minHeight: '200px',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite' }} />
        <div>Connecting & loading data...</div>
      </div>
    );
  }

  const { title, subtitle, items = [] } = data;

  // Filter items by search query
  const filteredItems = items.filter(item => {
    const query = searchQuery.toLowerCase();
    const titleMatch = item.title?.toLowerCase().includes(query);
    const subtitleMatch = item.subtitle?.toLowerCase().includes(query);
    const idMatch = item.id?.toLowerCase().includes(query);
    const detailMatch = item.details?.some(d => String(d.value).toLowerCase().includes(query) || d.label.toLowerCase().includes(query));
    return titleMatch || subtitleMatch || idMatch || detailMatch;
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  
  // Adjust current page if search filters out items
  const activePage = Math.min(currentPage, totalPages - 1);
  const startIndex = activePage * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedItems = filteredItems.slice(startIndex, endIndex);

  const getBadgeStyle = (type: string = 'neutral') => {
    const styles: Record<string, { bg: string; text: string }> = {
      success: {
        bg: isDark ? '#064e3b' : '#dcfce7',
        text: isDark ? '#34d399' : '#15803d'
      },
      warning: {
        bg: isDark ? '#451a03' : '#fef9c3',
        text: isDark ? '#fbbf24' : '#a16207'
      },
      info: {
        bg: isDark ? '#1e3a8a' : '#dbeafe',
        text: isDark ? '#60a5fa' : '#1d4ed8'
      },
      error: {
        bg: isDark ? '#7f1d1d' : '#fee2e2',
        text: isDark ? '#f87171' : '#b91c1c'
      },
      neutral: {
        bg: isDark ? '#334155' : '#f1f5f9',
        text: isDark ? '#cbd5e1' : '#475569'
      }
    };
    return styles[type] || styles.neutral;
  };

  return (
    <div style={{
      background: isDark ? '#0f172a' : '#f8fafc',
      color: isDark ? '#f8fafc' : '#0f172a',
      minHeight: '400px',
      maxHeight: maxHeight || '800px',
      overflowY: 'auto',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.025em' }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: '4px 0 0', color: isDark ? '#94a3b8' : '#64748b', fontSize: '14px' }}>
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '13px', fontWeight: '500' }}>
          Total: {items.length} items
        </div>
      </div>

      {/* Search Bar */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: isDark ? '#1e293b' : '#ffffff',
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        borderRadius: '12px',
        padding: '0 16px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <Search size={18} color={isDark ? '#64748b' : '#94a3b8'} style={{ marginRight: '10px' }} />
        <input
          type="text"
          placeholder="Search items, details, and badges..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(0);
          }}
          style={{
            width: '100%',
            padding: '12px 0',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: '14px',
            color: 'inherit'
          }}
        />
      </div>

      {/* Main List Grid */}
      {displayedItems.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: isDark ? '#1e293b' : '#ffffff',
          borderRadius: '16px',
          border: `1px dashed ${isDark ? '#334155' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Inbox size={40} color={isDark ? '#475569' : '#cbd5e1'} />
          <p style={{ margin: 0, fontSize: '15px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
            No items found matching search query
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {displayedItems.map((item, idx) => {
            const badgeStyle = getBadgeStyle(item.badge?.type);
            return (
              <div
                key={item.id || idx}
                style={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = isDark ? '0 8px 20px rgba(0,0,0,0.3)' : '0 8px 20px rgba(0,0,0,0.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)';
                }}
              >
                {/* Title & Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                        {item.title}
                      </h4>
                      {item.id && (
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: isDark ? '#64748b' : '#94a3b8' }}>
                          ({item.id})
                        </span>
                      )}
                    </div>
                    {item.subtitle && (
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', lineHeight: '1.4' }}>
                        {item.subtitle}
                      </p>
                    )}
                  </div>
                  {item.badge && (
                    <span style={{
                      background: badgeStyle.bg,
                      color: badgeStyle.text,
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {item.badge.text}
                    </span>
                  )}
                </div>

                {/* Details list */}
                {item.details && item.details.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingTop: '12px',
                    borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`
                  }}>
                    {item.details.map((detail, dIdx) => (
                      <div key={dIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: isDark ? '#64748b' : '#94a3b8', fontWeight: '500' }}>
                          {detail.label}
                        </span>
                        <span style={{ fontWeight: '600', color: isDark ? '#cbd5e1' : '#334151' }}>
                          {detail.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '16px',
          borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
          marginTop: 'auto'
        }}>
          <button
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={activePage === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              background: isDark ? '#1e293b' : '#ffffff',
              color: 'inherit',
              cursor: activePage === 0 ? 'not-allowed' : 'pointer',
              opacity: activePage === 0 ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </button>
          
          <span style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
            Page {activePage + 1} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={activePage === totalPages - 1}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              background: isDark ? '#1e293b' : '#ffffff',
              color: 'inherit',
              cursor: activePage === totalPages - 1 ? 'not-allowed' : 'pointer',
              opacity: activePage === totalPages - 1 ? 0.5 : 1,
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
