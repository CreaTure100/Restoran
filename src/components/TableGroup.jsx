import React from 'react';

const TableGroup = ({ table, type, cx, cy, x, labelX, labelY, isSelected, onClick }) => {
  const { id, status } = table;
  
  if (type === 'round') {
    return (
      <g 
        className={`table-group status-${status} ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        style={{ cursor: status === 'booked' ? 'not-allowed' : 'pointer' }}
      >
        <circle cx={cx } cy={cy - 19} r="9" className="chair-circle"/>
        <circle cx={cx } cy={cy + 19} r="9" className="chair-circle"/>
        <circle cx={cx - 22} cy={cy } r="9" className="chair-circle"/>
        <circle cx={cx + 22} cy={cy} r="9" className="chair-circle"/>
        <circle cx={cx} cy={cy} r="22" className="table-base"/>
        <text x={cx} y={cy} className="table-label">{id}</text>
      </g>
    );
  }
  
  if (type === 'large') {
    return (
      <g 
        className={`table-group status-${status} ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        style={{ cursor: status === 'booked' ? 'not-allowed' : 'pointer' }}
      >
        <circle cx="496" cy="210" r="10" className="chair-circle"/>
        <circle cx="496" cy="236" r="10" className="chair-circle"/>
        <circle cx="526" cy="198" r="10" className="chair-circle"/>
        <circle cx="526" cy="248" r="10" className="chair-circle"/>
        <circle cx="556" cy="210" r="10" className="chair-circle"/>
        <circle cx="556" cy="236" r="10" className="chair-circle"/>
        <circle cx={cx} cy={cy} r="28" className="table-base"/>
        <text x={cx} y={cy} className="table-label" fontSize="12">{id}</text>
      </g>
    );
  }
  
  if (type === 'booth') {
    return (
      <g 
        className={`table-group status-${status} ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        style={{ cursor: status === 'booked' ? 'not-allowed' : 'pointer' }}
      >
        <rect x={x} y="344" width="14" height="65" rx="3" className="chair-circle"/>
        <rect x={x+57} y="344" width="14" height="65" rx="3" className="chair-circle"/>
        <rect x={x+14} y="349" width="43" height="55" rx="3" className="table-base"/>
        <text x={labelX} y={labelY} className="table-label">{id}</text>
      </g>
    );
  }
  
  if (type === 'rect') {
    return (
      <g 
        className={`table-group status-${status} ${isSelected ? 'selected' : ''}`}
        onClick={onClick}
        style={{ cursor: status === 'booked' ? 'not-allowed' : 'pointer' }}
      >
        <circle cx="600" cy="223" r="9" className="chair-circle"/>
        <circle cx="600" cy="248" r="9" className="chair-circle"/>
        <circle cx="600" cy="273" r="9" className="chair-circle"/>
        <circle cx="672" cy="223" r="9" className="chair-circle"/>
        <circle cx="672" cy="248" r="9" className="chair-circle"/>
        <circle cx="672" cy="273" r="9" className="chair-circle"/>
        <rect x="612" y="210" width="48" height="76" rx="4" className="table-base"/>
        <text x="636" y="248" className="table-label">17</text>
      </g>
    );
  }
  
  return null;
};

export default TableGroup;
