/**
 * Generates a random 4-digit pin code.
 * @returns - A random 4-digit pin code.
 */
const generatePinCode = () => {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return randomNum.toString();
};

export default generatePinCode;
