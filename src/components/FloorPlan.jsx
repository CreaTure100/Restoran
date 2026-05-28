import React from 'react';
import TableGroup from './TableGroup';

const FloorPlan = ({ tables, selectedTable, onTableClick }) => {
  // Данные для столиков в SVG координатах
  const tablePositions = {
    // Первый ряд
    1: { cx: 160, cy: 169, type: 'round' },
    2: { cx: 232, cy: 169, type: 'round' },
    3: { cx: 304, cy: 169, type: 'round' },
    4: { cx: 376, cy: 169, type: 'round' },
    5: { cx: 448, cy: 169, type: 'round' },
    // Второй ряд
    6: { cx: 175, cy: 267, type: 'round' },
    7: { cx: 255, cy: 267, type: 'round' },
    8: { cx: 335, cy: 267, type: 'round' },
    9: { cx: 415, cy: 267, type: 'round' },
    // Стол 10
    10: { cx: 526, cy: 223, type: 'large' },
    // Столы с диванами
    11: { x: 269, y: 377, type: 'booth', index: 0 },
    12: { x: 340, y: 377, type: 'booth', index: 1 },
    13: { x: 411, y: 377, type: 'booth', index: 2 },
    14: { x: 482, y: 377, type: 'booth', index: 3 },
    15: { x: 553, y: 377, type: 'booth', index: 4 },
    16: { x: 624, y: 377, type: 'booth', index: 5 },
    // Стол 17
    17: { type: 'rect' }
  };

  return (
    <div className="floor-plan-wrapper">
      <svg width="760" height="460" viewBox="0 0 760 460">
        <defs>
        {/* Текстура плитки пола */}
          <pattern id="tilePattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none" stroke="#e0dbd2" strokeWidth="0.6"/>
          </pattern>
        </defs>

        {/* Внешняя оболочка */}
        <rect x="0" y="0" width="760" height="460" fill="#1a1a1a"/>

        {/* Стены */}
        <polygon points="0,0 760,0 740,14 20,14" fill="#2c2c2c"/>
        <polygon points="0,460 760,460 740,446 20,446" fill="#2c2c2c"/>
        <polygon points="0,0 20,14 20,446 0,460" fill="#242424"/>
        <polygon points="760,0 740,14 740,446 760,460" fill="#242424"/>

        {/* Wide faces */}
        <polygon points="20,14 740,14 720,34 40,34" fill="#d6cfc4"/>
        <polygon points="20,446 740,446 720,426 40,426" fill="#d0c9be"/>
        <polygon points="20,14 40,34 40,426 20,446" fill="#cec7bc"/>
        <polygon points="740,14 720,34 720,426 740,446" fill="#cec7bc"/>

        {/* Пол */}
        <rect x="40" y="34" width="680" height="392" fill="#f5f0e8"/>
        <rect x="40" y="34" width="680" height="392" fill="url(#tilePattern)"/>

        {/* Подоконники */}
        {[244, 315, 386, 457, 528, 599].map(x => (
          <g key={x}>
            <rect x={x} y="418" width="50" height="8" rx="2" fill="#f0c84a" opacity="0.55"/>
            <rect x={x} y="410" width="50" height="8" rx="2" fill="#f0c84a" opacity="0.25"/>
            <rect x={x} y="402" width="50" height="8" rx="2" fill="#f0c84a" opacity="0.08"/>
          </g>
        ))}

        {/* Окна */}
        {[
          [250, 288, 252], [321, 359, 323], [392, 430, 394],
          [463, 501, 465], [534, 572, 536], [605, 643, 607]
        ].map(([x1, x2, x3], i) => (
          <polygon key={i} points={`${x1},431 ${x2},431 ${x2+2},441 ${x3},441`} 
                   fill="#f0d070" stroke="#c09030" strokeWidth="0.8"/>
        ))}

        {/* Барная стойка */}
        <rect x="200" y="34" width="300" height="46" fill="#ddd5c4" stroke="#a09080" strokeWidth="1.2"/>
        <rect x="200" y="34" width="300" height="7" fill="#b0a898"/>
        <rect x="200" y="41" width="300" height="3" fill="#e8e0d0" opacity="0.6"/>
        {/* Барные стулья */}
        {[228, 258, 288, 318, 348, 378, 408, 438, 468].map(cx => (
          <circle key={cx} cx={cx} cy="84" r="8" fill="#c8bfaf" stroke="#807060" strokeWidth="1.2"/>
        ))}
        <text x="350" y="58" className="room-label" fontSize="10">БАР</text>

        {/* WC */}
        <rect x="40" y="34" width="100" height="95" fill="#e4dfd7" stroke="#b0a898" strokeWidth="1"/>
        <rect x="136" y="34" width="4" height="95" fill="#b0a898"/>
        <text x="90" y="82" className="room-label">WC</text>

        {/* ХОСТЕС */}
        <rect x="40" y="336" width="153" height="90" fill="#e0dbd3" stroke="#b0a898" strokeWidth="1"/>
        <rect x="193" y="336" width="4" height="90" fill="#b0a898"/>
        <text x="116" y="383" className="room-label">ХОСТЕС</text>

        {/* Дверь */}
        <rect x="524" y="0" width="52" height="14" fill="#2c2c2c"/>
        <rect x="524" y="0" width="52" height="5" fill="#2c2c2c"/>
        <rect x="524" y="14" width="52" height="20" fill="#d6cfc4"/>
        <rect x="524" y="14" width="52" height="6" fill="#d6cfc4"/>
        <rect x="524" y="17" width="26" height="17" rx="1" fill="#b0a898"/>
        <rect x="527" y="19" width="20" height="13" rx="0.5" fill="#c8bfaf" opacity="0.45"/>
        <rect x="543" y="23" width="2" height="7" rx="1" fill="#6a5a4a"/>
        <circle cx="544" cy="23.5" r="1.5" fill="#5a4a3a"/>
        <circle cx="544" cy="29.5" r="1.5" fill="#5a4a3a"/>
        <line x1="550" y1="17" x2="550" y2="34" stroke="#7a6a5a" strokeWidth="0.8"/>
        <rect x="550" y="17" width="26" height="17" rx="1" fill="#b0a898"/>
        <rect x="553" y="19" width="20" height="13" rx="0.5" fill="#c8bfaf" opacity="0.45"/>
        <rect x="554" y="23" width="2" height="7" rx="1" fill="#6a5a4a"/>
        <circle cx="555" cy="23.5" r="1.5" fill="#5a4a3a"/>
        <circle cx="555" cy="29.5" r="1.5" fill="#5a4a3a"/>

        <rect x="80" y="426" width="36" height="20" fill="#d0c9be"/>
        <rect x="80" y="426" width="36" height="3" fill="#b8b0a4"/>
        <rect x="80" y="429" width="36" height="15" rx="1" fill="#b0a898"/>
        <rect x="83" y="431" width="30" height="11" rx="0.5" fill="#c8bfaf" opacity="0.45"/>
        <rect x="85" y="433" width="2" height="5" rx="1" fill="#6a5a4a"/>
        <circle cx="86" cy="433.5" r="1.5" fill="#5a4a3a"/>
        <circle cx="86" cy="437.5" r="1.5" fill="#5a4a3a"/>
        <polygon points="80,446 116,446 118,460 82,460" fill="#2c2c2c"/>
        <rect x="80" y="446" width="36" height="5" fill="#2c2c2c"/>
        
        {/* Столы */}
        {tables.map(table => {
          const pos = tablePositions[table.id];
          if (!pos) return null;
          
          if (pos.type === 'round') {
            return (
              <TableGroup
                key={table.id}
                table={table}
                type="round"
                cx={pos.cx}
                cy={pos.cy}
                isSelected={selectedTable?.id === table.id}
                onClick={() => onTableClick(table.id)}
              />
            );
          }
          
          if (pos.type === 'large') {
            return (
              <TableGroup
                key={table.id}
                table={table}
                type="large"
                cx={pos.cx}
                cy={pos.cy}
                isSelected={selectedTable?.id === table.id}
                onClick={() => onTableClick(table.id)}
              />
            );
          }
          
          if (pos.type === 'booth') {
            const x = 234 + pos.index * 71;
            return (
              <TableGroup
                key={table.id}
                table={table}
                type="booth"
                x={x}
                labelX={pos.x}
                labelY={pos.y}
                isSelected={selectedTable?.id === table.id}
                onClick={() => onTableClick(table.id)}
              />
            );
          }
          
          if (table.id === 17) {
            return (
              <TableGroup
                key={table.id}
                table={table}
                type="rect"
                isSelected={selectedTable?.id === table.id}
                onClick={() => onTableClick(table.id)}
              />
            );
          }
          
          return null;
        })}

        {/*Пианино */}
        <g transform="translate(628, 36)">
          <path d="M 4,6 L 94,6 Q 96,6 96,8 L 96,82 Q 94,108 70,120 Q 48,130 24,122 Q 6,116 4,100 Z" 
                fill="#0d0d0d" opacity="0.45" transform="translate(3,3)"/>
          <path d="M 4,4 L 92,4 Q 96,4 96,8 L 96,80 Q 94,106 70,118 Q 48,128 24,120 Q 6,114 4,98 Z" 
                fill="#1c1814" stroke="#0a0806" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M 28,100 Q 60,106 90,100 Q 92,100 92,104 L 92,106 Q 80,112 56,118 Q 36,124 28,112 Z" 
                fill="#050402"/>
          <path d="M 28,6 L 92,6 Q 94,6 94,10 L 94,96 Q 92,102 70,108 Q 50,114 28,106 L 28,6 Z" 
                fill="#2a2218" stroke="#0a0806" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M 28,6 L 92,6 Q 94,6 94,10 L 94,18 Q 60,14 28,14 Z" 
                fill="#5a5048" opacity="0.7"/>
          <path d="M 28,106 Q 50,114 70,108 Q 92,102 94,96" 
                fill="none" stroke="#6a5e52" strokeWidth="1.2"/>
          <line x1="28" y1="106" x2="28" y2="120" stroke="#5a4e44" strokeWidth="1.5"/>
          <circle cx="28" cy="120" r="2" fill="#3a3028"/>
          <line x1="28" y1="6" x2="92" y2="6" stroke="#4a3e34" strokeWidth="1.2" opacity="0.8"/>
          <rect x="4" y="4" width="22" height="114" rx="1" fill="#e8e4dc" stroke="#0a0806" strokeWidth="1.5"/>
          {[9, 17, 33, 41, 49, 65, 73, 89, 97, 105].map(y => (
            <rect key={y} x="16" y={y} width="8" height="5" rx="0.5" fill="#1a1814"/>
          ))}
          {[12, 20, 28, 36, 44, 52, 60, 68, 76, 84, 92, 100, 108].map(y => (
            <line key={y} x1="4" y1={y} x2="26" y2={y} stroke="#888" strokeWidth="0.5"/>
          ))}
          <path d="M 92,10 L 96,14 L 96,80 Q 94,106 70,118 Q 60,124 48,126"
                fill="none" stroke="#3a3028" strokeWidth="1.5" opacity="0.5"/>
        </g>
        <rect x="612" y="90" width="14" height="20" rx="2" fill="#2a2218" stroke="#0a0806" strokeWidth="1"/>
      </svg>
    </div>
  );
};

export default FloorPlan;
