import React, { useContext } from 'react';
import { CartContext } from '../App'; // Or update if moved CartContext to its own file

function Cart() {
  const { cart, removeFromCart, updateCartQuantity } = useContext(CartContext);

  if (cart.length === 0) return null;

  return (
    <div className="cart-container">
      <div className="cart tall-rectangular-cart">
        <h2>Your Cart</h2>
        {cart.map(item => {
          const handleIncrement = () => {
            if (item.quantity < item.stock) {
              updateCartQuantity(item.id, item.quantity + 1);
            }
          };

          const handleDecrement = () => {
            if (item.quantity > 1) {
              updateCartQuantity(item.id, item.quantity - 1);
            }
          };

          const handleManualChange = (e) => {
            const value = e.target.value;
            if (value === "") {
              updateCartQuantity(item.id, "");
              return;
            }
            if (!isNaN(value) && value >= 1 && value <= item.stock) {
              updateCartQuantity(item.id, Number(value));
            }
          };

          const handleBlur = (e) => {
            if (e.target.value === "") {
              updateCartQuantity(item.id, 1);
            }
          };

          return (
            <div key={item.id} className="cart-item">
              <img
                src={item.image_path}
                alt={item.name}
                className="cart-item-image scale-image"
              />
              <div className="cart-item-details">
                <p>{item.name}</p>
                <p>Price: ${item.price}</p>
                <div className="quantity-selector">
                  <button
                    onClick={handleDecrement}
                    className={`quantity-btn ${item.quantity === 1 ? 'disabled' : ''}`}
                    disabled={item.quantity === 1}
                  >
                    –
                  </button>
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={handleManualChange}
                    onBlur={handleBlur}
                    className="quantity-input"
                  />
                  <button
                    onClick={handleIncrement}
                    className={`quantity-btn ${item.quantity === item.stock ? 'disabled' : ''}`}
                    disabled={item.quantity === item.stock}
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        <button className="proceed-btn">Proceed to Payment</button>
      </div>
    </div>
  );
}

export default Cart;
