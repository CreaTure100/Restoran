import React from 'react';
import FloorPlan from '../components/FloorPlan';
import BookingSidebar from '../components/BookingSidebar';

const TablesPage = ({ tables, selectedTable, onTableClick, onBook, adminError }) => {
  return (
    <div id="page-tables" className="page active">
      <div className="page-header">
        <h1>Выбор столика</h1>
        <p>Нажмите на стол, чтобы забронировать</p>
      </div>
      <div className="tables-layout">
        <FloorPlan 
          tables={tables}
          selectedTable={selectedTable}
          onTableClick={onTableClick}
        />
        <BookingSidebar 
          selectedTable={selectedTable}
          onBook={onBook}
          adminError={adminError}
        />
      </div>
    </div>
  );
};

export default TablesPage;