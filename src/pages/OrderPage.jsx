import React from 'react';
import MenuSheet from '../components/MenuSheet';

const OrderPage = ({ bookingInfo, quantities, onQuantityChange, onPay, onBack, menuItems, dishComments, onDishCommentChange }) => {
  return (
    <div className="order-page">
      <MenuSheet 
        bookingInfo={bookingInfo}
        quantities={quantities}
        menuItems={menuItems}
        dishComments={dishComments}
        onQuantityChange={onQuantityChange}
        onDishCommentChange={onDishCommentChange}
        onPay={onPay}
        onBack={onBack}
      />
    </div>
  );
};

export default OrderPage;