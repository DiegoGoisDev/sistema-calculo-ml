/** Repassa erros de funções async para o errorHandler do Express. */
export default (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err);
  }
};
