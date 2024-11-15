module.exports.hello = async event => {
  
  myvar = "test"

  return {
      statusCode: 200,
      body: JSON.stringify({
          message: 'hello world'
      })
  };
}
