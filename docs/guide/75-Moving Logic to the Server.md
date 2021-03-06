# Moving Logic to the Server

In the previous article we've create a process that runs for each product and updates it. 
As we've written this process, it runs in the browser, requesting the server for a list of products, and then for every product sends another request to the server to perform the update.
Although this is valid when you have 10-20 products, if you have a 1000 products this can become slow, as each `save` call will take 0.1 seconds - times 1000 it's more than a minute.

An easy way to improve the performance, is to make a single call to the server and do all the business logic there.

Let's refactor the code to do that:

<<< @/docs-code/products-batch-operations/products.component.ts{18-27} 

* We've created a new static method called `updatePriceOnServer` and moved the code to it
* * note that the `context` parameter is marked as optional - that parameter will automatically be populated with the server context once this method will run on the server.
* * note that since this is a `static` method, we can't use the `this` keyword so instead of writing `this.context.for(Products)` we write `context.for(Products) ` and we receive the context as a parameter.
* * note that we also that the parameter `priceToUpdate` is typed, which means that we achieved type check across backend calls.
* We've tagged it with the `@ServerFunction` decorator to indicate that it runs on the server and we've moved the code to it.
* * In the parameter sent to the `@ServerFunction` decorator, we've set the `allowed` property to `true` indicating that anyone can run this function. Later we'll restrict it to users with specific roles.

If we'll review the output of the `node-serve` window, we'll see that a new API entry was added to the list:
```sh{3}
/api/signIn
/api/resetPassword
/api/updatePriceOnServer
/api/Categories
/api/Products
/api/Users
```