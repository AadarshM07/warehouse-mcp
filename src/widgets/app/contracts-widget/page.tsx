'use client';

import React, { useState, useEffect } from 'react';
import { useTheme, useMaxHeight, useWidgetSDK } from '@nitrostack/widgets';
import { RefreshCw, CheckCircle2, XCircle, AlertCircle, FileText, Check, X } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ContractItem {
  id: string;
  sku: string;
  reorderPoint: number;
  reorderQuantity: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

interface ContractsWidgetData {
  title: string;
  subtitle?: string;
  items: ContractItem[];
}

export default function ContractsWidget() {
  const theme = useTheme();
  const maxHeight = useMaxHeight();
  const isDark = theme === 'dark';
  const { isReady, getToolOutput, callTool } = useWidgetSDK();
  
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const initialData = getToolOutput<ContractsWidgetData>();

  // Synchronize initial data to local state
  useEffect(() => {
    if (initialData?.items) {
      setContracts(initialData.items);
    }
  }, [initialData]);

  // Refresh contracts list from backend
  const refreshList = async () => {
    try {
      const response = await callTool('list_supplier_contracts', {});
      if (response && (response as any).items) {
        setContracts((response as any).items);
      }
    } catch (err) {
      console.error('Failed to refresh contracts:', err);
    }
  };

  const handleApprove = async (contractId: string) => {
    setActionLoading(contractId);
    setMessage(null);
    try {
      const res = await callTool('approve_reorder_contract', { contractId });
      setMessage({ text: 'Contract successfully approved and SKU settings updated!', type: 'success' });
      await refreshList();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to approve contract.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (contractId: string) => {
    setActionLoading(contractId);
    setMessage(null);
    try {
      const res = await callTool('reject_reorder_contract', { contractId });
      setMessage({ text: 'Contract rejected.', type: 'success' });
      await refreshList();
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to reject contract.', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isReady || !initialData) {
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
        <div>Connecting & loading contracts...</div>
      </div>
    );
  }

  const { title, subtitle } = initialData;

  const getStatusBadge = (status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    const styles = {
      PENDING: {
        bg: isDark ? '#451a03' : '#fef9c3',
        text: isDark ? '#fbbf24' : '#a16207',
        icon: <AlertCircle size={14} />
      },
      APPROVED: {
        bg: isDark ? '#064e3b' : '#dcfce7',
        text: isDark ? '#34d399' : '#15803d',
        icon: <CheckCircle2 size={14} />
      },
      REJECTED: {
        bg: isDark ? '#7f1d1d' : '#fee2e2',
        text: isDark ? '#f87171' : '#b91c1c',
        icon: <XCircle size={14} />
      }
    };
    return styles[status] || styles.PENDING;
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
        <button
          onClick={refreshList}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            background: isDark ? '#1e293b' : '#ffffff',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500'
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Alert Message Toast */}
      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: message.type === 'success' ? (isDark ? '#064e3b' : '#dcfce7') : (isDark ? '#7f1d1d' : '#fee2e2'),
          color: message.type === 'success' ? (isDark ? '#34d399' : '#15803d') : (isDark ? '#f87171' : '#b91c1c'),
          border: `1px solid ${message.type === 'success' ? (isDark ? '#0f766e' : '#bbf7d0') : (isDark ? '#991b1b' : '#fecaca')}`
        }}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Contracts Grid */}
      {contracts.length === 0 ? (
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
          <FileText size={40} color={isDark ? '#475569' : '#cbd5e1'} />
          <p style={{ margin: 0, fontSize: '15px', color: isDark ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
            No reorder contracts found for your supplier account
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {contracts.map((contract) => {
            const badge = getStatusBadge(contract.status);
            const isLoading = actionLoading === contract.id;

            return (
              <div
                key={contract.id}
                style={{
                  background: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {/* Header: SKU & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', letterSpacing: '-0.01em' }}>
                    {contract.sku}
                  </h4>
                  <span style={{
                    background: badge.bg,
                    color: badge.text,
                    padding: '4px 8px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    {badge.icon}
                    {contract.status}
                  </span>
                </div>

                {/* Details Section */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px 0',
                  borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`,
                  borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Reorder Point</span>
                    <span style={{ fontWeight: '600' }}>{contract.reorderPoint} units</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Reorder Quantity</span>
                    <span style={{ fontWeight: '600' }}>{contract.reorderQuantity} units</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: isDark ? '#64748b' : '#94a3b8' }}>Date Created</span>
                    <span style={{ fontWeight: '500' }}>{new Date(contract.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                {contract.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
                    <button
                      onClick={() => handleReject(contract.id)}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1px solid transparent',
                        background: isDark ? '#7f1d1d' : '#fee2e2',
                        color: isDark ? '#f87171' : '#b91c1c',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        opacity: isLoading ? 0.6 : 1
                      }}
                    >
                      <X size={14} />
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(contract.id)}
                      disabled={isLoading}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '10px',
                        borderRadius: '10px',
                        border: '1px solid transparent',
                        background: isDark ? '#064e3b' : '#dcfce7',
                        color: isDark ? '#34d399' : '#15803d',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: '600',
                        opacity: isLoading ? 0.6 : 1
                      }}
                    >
                      {isLoading ? (
                        <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Check size={14} />
                      )}
                      Approve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
