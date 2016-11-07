export const strongestSoFar = (acc = { mag: 0 }, val) => {
  return val.mag > acc.mag ? val : acc;
};

export const latestSoFar = (acc = 0, val) => {
  return val.time > acc.time ? val : acc;
};
