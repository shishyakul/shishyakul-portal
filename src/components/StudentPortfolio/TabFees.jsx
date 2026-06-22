import React from 'react';

export default function TabFees({ student }) {
  const instCount = student.installments || 1;
  const instAmount = (student.totalFees || 0) / instCount;
  const paidArr = student.paidInstallments || [];
  const details = student.paymentDetails || {};

  return (
    <div className="sd-profile-body">
      <div className="sd-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 className="sd-section-title" style={{ margin: 0 }}>
            <span className="material-symbols-outlined">account_balance_wallet</span>
            Fee Schedule & Payments
          </h3>
          <button className="btn-ghost btn-sm" disabled style={{ opacity: 0.5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: '16px', marginRight: '4px' }}>receipt_long</span>
            Generate Receipt
          </button>
        </div>

        <div style={{ marginBottom: '24px', display: 'flex', gap: '24px', background: 'var(--surface-bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Fees</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>₹{(student.totalFees || 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Applied Discount</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--status-success)' }}>-₹{(student.discount || 0).toLocaleString()}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Net Payable</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--brand-primary)' }}>₹{((student.totalFees || 0) - (student.discount || 0)).toLocaleString()}</div>
          </div>
        </div>

        <table className="sd-table">
          <thead>
            <tr>
              <th>Installment Name</th>
              <th>Amount (₹)</th>
              <th>Status / Mode</th>
              <th>Date / Details</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: instCount }).map((_, idx) => {
              const isPaid = paidArr.includes(idx);
              const payInfo = details[idx];
              return (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>Installment {idx + 1}</td>
                  <td style={{ fontWeight: 600, color: isPaid ? 'var(--status-success)' : 'var(--text-primary)' }}>
                    ₹{isPaid && payInfo ? payInfo.amount.toLocaleString() : instAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td>
                    {isPaid && payInfo ? (
                      <span className="sd-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>{payInfo.mode}</span>
                    ) : (
                      <span className="sd-badge" style={{ background: 'var(--surface-bg)', color: 'var(--text-secondary)', border: '1px solid var(--surface-border)' }}>Pending</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {isPaid && payInfo ? (
                      <div>
                        <div>{new Date(payInfo.paidAt).toLocaleDateString()}</div>
                        {payInfo.proof && <div style={{ fontSize: '11px', color: 'var(--brand-primary)' }}>Proof: {payInfo.proof}</div>}
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
