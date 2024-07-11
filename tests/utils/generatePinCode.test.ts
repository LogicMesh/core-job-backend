import generatePinCode from '../../src/utils/generatePinCode';

describe('generatePinCode', () => {
  it('should generate a 4-digit pin code', () => {
    const pinCode = generatePinCode();

    // Check if the generated pin code is a string
    expect(typeof pinCode).toBe('string');

    // Check if the length of the pin code is 4
    expect(pinCode.length).toBe(4);

    const pinCodeNumber = parseInt(pinCode, 10);

    // Check if the pin code is a number between 1000 and 9999
    expect(pinCodeNumber).toBeGreaterThanOrEqual(1000);
    expect(pinCodeNumber).toBeLessThanOrEqual(9999);
  });

  it('should generate different pin codes', () => {
    const pinCode1 = generatePinCode();
    const pinCode2 = generatePinCode();

    /**
     * There's a very small chance that the same pin code could be generated twice
     * But this test case checks if the function is generating different pin codes in most cases.
     */
    expect(pinCode1).not.toBe(pinCode2);
  });
});
