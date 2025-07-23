export const setBodyBackground = (color: string) => {
  document.body.style.background = color;
  document.documentElement.style.background = color;
};

export const addCssClass = (className: string) => {
  document.body.classList.add(className);
  document.documentElement.classList.add(className);
};

export const removeCssClass = (className: string) => {
  document.body.classList.remove(className);
  document.documentElement.classList.remove(className);
};