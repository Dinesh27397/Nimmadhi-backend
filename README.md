<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Nimmadhi Auth MVP

### Required install commands

```bash
npm install
npm install @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/swagger swagger-ui-express
npm install --save-dev @types/bcrypt @types/passport-jwt
```

### Required `.env` keys

```bash
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/nimmadhi_db?schema=public"
JWT_SECRET="replace-with-access-secret"
JWT_REFRESH_SECRET="replace-with-refresh-secret"
JWT_ONBOARDING_SECRET="replace-with-onboarding-secret"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
OTP_EXPIRES_IN_SECONDS="300"
```

### Prisma commands

```bash
npx prisma generate
npx prisma migrate dev --name auth_mvp
```

Use `npx prisma migrate deploy` in deployed environments after the migration has been created and committed.

### API testing with curl

```bash
curl -X POST http://localhost:3000/auth/request-otp \
  -H "Content-Type: application/json" \
  -d "{\"mobile\":\"9876543210\"}"

curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"mobile\":\"9876543210\",\"otp\":\"123456\"}"

curl -X POST http://localhost:3000/auth/complete-profile \
  -H "Authorization: Bearer ONBOARDING_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"mobile\":\"9876543210\",\"fullName\":\"Dinesh Kumar\",\"monthlyIncome\":90000,\"employmentType\":\"SALARIED\",\"monthlyExpenses\":25000,\"existingEmiTotal\":12000,\"hasCreditCardDues\":true,\"creditCardDueAmount\":5000}"

curl -X POST http://localhost:3000/auth/set-pin \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pin\":\"1234\",\"confirmPin\":\"1234\"}"

curl -X POST http://localhost:3000/auth/login-pin \
  -H "Content-Type: application/json" \
  -d "{\"mobile\":\"9876543210\",\"pin\":\"1234\"}"

curl -X POST http://localhost:3000/auth/refresh-token \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"REFRESH_TOKEN\"}"

curl -X POST http://localhost:3000/auth/logout \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"REFRESH_TOKEN\"}"

curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Postman flow

1. `POST /auth/request-otp` with `{ "mobile": "9876543210" }`. In development, copy `devOtp` from the response or console.
2. `POST /auth/verify-otp` with the mobile and OTP. Existing users receive access and refresh tokens. New users receive an onboarding token.
3. For the current MVP, call `POST /auth/complete-profile` with the mobile number, personal details, and financial snapshot in the body.
4. Add one or more loans with `POST /loans`.
5. Read loans with `GET /loans?mobile=9876543210`.
6. Read dashboard home data with `GET /dashboard/home?mobile=9876543210`.
7. Optional older auth endpoints still exist: `POST /auth/set-pin`, `POST /auth/login-pin`, `POST /auth/refresh-token`, and `GET /auth/me`.

Swagger is available at `http://localhost:3000/docs` while the server is running.

### MVP profile, loan, and dashboard examples

Development OTP is hardcoded as `123456`. Production generates a random
six-digit OTP and never includes it in the API response.

Complete profile:

```bash
curl -X POST http://localhost:3000/auth/complete-profile \
  -H "Content-Type: application/json" \
  -d "{\"mobile\":\"9876543210\",\"fullName\":\"Dinesh Kumar\",\"monthlyIncome\":90000,\"employmentType\":\"SALARIED\",\"monthlyExpenses\":25000,\"existingEmiTotal\":12000,\"hasCreditCardDues\":false}"
```

Create loan:

```bash
curl -X POST http://localhost:3000/loans \
  -H "Content-Type: application/json" \
  -d "{\"mobile\":\"9876543210\",\"loanName\":\"Personal Loan\",\"loanType\":\"PERSONAL_LOAN\",\"lenderName\":\"HDFC Bank\",\"outstandingAmount\":250000,\"monthlyEmi\":8500,\"interestRate\":14.5,\"dueDay\":5,\"tenureRemainingMonths\":36}"
```

List loans:

```bash
curl "http://localhost:3000/loans?mobile=9876543210"
```

Get loan by id:

```bash
curl "http://localhost:3000/loans/LOAN_ID"
```

Update loan:

```bash
curl -X PATCH http://localhost:3000/loans/LOAN_ID \
  -H "Content-Type: application/json" \
  -d "{\"monthlyEmi\":9000,\"interestRate\":13.5}"
```

Delete loan:

```bash
curl -X DELETE http://localhost:3000/loans/LOAN_ID
```

Dashboard summary:

```bash
curl "http://localhost:3000/dashboard/summary?mobile=9876543210"
```

Dashboard home screen:

```bash
curl "http://localhost:3000/dashboard/home?mobile=9876543210"
```

### Protected strategy and recommendation examples

Set `ACCESS_TOKEN` to a JWT returned by your login or OTP verification flow.

Update financial profile:

```bash
curl -X PUT http://localhost:3000/financial-profile \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"monthlyIncome\":90000,\"monthlyEssentialExpenses\":25000,\"emergencyFund\":50000}"
```

Get financial profile:

```bash
curl http://localhost:3000/financial-profile \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Repayment plan:

```bash
curl "http://localhost:3000/strategy/repayment-plan?method=AVALANCHE" \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Recommendations:

```bash
curl http://localhost:3000/recommendations/today \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

Affordability check:

```bash
curl -X POST http://localhost:3000/affordability/check \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"itemName\":\"iPhone\",\"price\":80000,\"downPayment\":20000,\"monthlyEmi\":5000,\"tenureMonths\":12}"
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
