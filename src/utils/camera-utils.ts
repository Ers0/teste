export const setBodyBackground = (color: string) => {
  document.body.style.background = color;
};

export const addCssClass = (className: string) => {
  document.body.classList.add(className);
};

export const removeCssClass = (className: string) => {
  document.body.classList.remove(className);
};