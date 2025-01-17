import { booleanArg, mutationType, nonNull, nullable, stringArg } from "nexus";
import bcrypt from "bcryptjs";
import { TContext } from "^/utils/serverTypes";
import { COOKIE_NAME } from "^/utils/constants";
import { AuthResponseData } from ".";
import { CreatePostResponseData } from ".";

export const Mutations = mutationType({
  definition(t) {
    // REGISTER USER
    t.field("RegisterUser", {
      type: AuthResponseData,
      args: {
        name: nonNull(stringArg()),
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
        loginDirectly: nonNull(booleanArg()),
      },
      async resolve(
        _,
        { name, email, password, loginDirectly },
        ctx: TContext
      ) {
        try {
          if (name.length < 2) {
            return {
              msg: "Name cannot be less than 2 characters",
              fields: ["name"],
              success: false,
            };
          }

          if (email.length === 0) {
            return {
              msg: "Email cannot be empty",
              fields: ["email"],
              success: false,
            };
          }

          if (!email.includes("@") && !email.includes(".")) {
            return {
              msg: "Invalid email address",
              fields: ["email"],
              success: false,
            };
          }

          if (password.length <= 4) {
            return {
              msg: "Password cannot be less than 4 characters",
              fields: ["password"],
              success: false,
            };
          }

          const userWhenInputName = await ctx.db.user.findUnique({
            where: {
              name,
            },
          });

          if (userWhenInputName) {
            return {
              msg: `Username: ${name} already exists`,
              fields: ["name"],
              success: false,
            };
          }

          const user = await ctx.db.user.findUnique({
            where: {
              email,
            },
          });

          if (user) {
            return {
              msg: `Email: ${email} already exists`,
              fields: ["email"],
              success: false,
            };
          }

          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(password, salt);

          const newUser = await ctx.db.user.create({
            data: {
              name,
              email,
              password: hashedPassword,
            },
          });

          if (loginDirectly) {
            ctx.req.session.userId = newUser.id;
            return {
              msg: "Account created and logged in successfully",
              fields: [],
              success: true,
            };
          }

          return {
            msg: "Account created successfully",
            fields: [],
            success: true,
          };
        } catch (error) {
          throw Error(`Internal server error: ${error}`);
        }
      },
    });
    // LOGIN USER
    t.field("LoginUser", {
      type: AuthResponseData,
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      async resolve(_, { email, password }, ctx: TContext) {
        try {
          if (email.length === 0) {
            return {
              msg: "Email cannot be empty",
              fields: ["email"],
              success: false,
            };
          }

          if (!email.includes("@") && !email.includes(".")) {
            return {
              msg: "Invalid email address",
              fields: ["email"],
              success: false,
            };
          }

          if (password.length <= 4) {
            return {
              msg: "Password cannot be less than 4 characters",
              fields: ["password"],
              success: false,
            };
          }

          const user = await ctx.db.user.findUnique({
            where: {
              email,
            },
          });

          if (!user) {
            return {
              msg: `Email: "${email}" not found`,
              fields: ["email"],
              success: false,
            };
          }

          const { password: userPasword, ...userInfo } = user;

          const isPasswordVerified = await bcrypt.compare(
            password,
            userPasword
          );

          if (!isPasswordVerified) {
            return {
              msg: "Wrong password",
              fields: ["password"],
              success: false,
            };
          }

          ctx.req.session.userId = userInfo.id;

          return {
            msg: "User authenticated",
            fields: [],
            success: true,
          };
        } catch (error) {
          throw Error(`Internal server error: ${error}`);
        }
      },
    });
    // LOGOUT USER
    t.field("LogoutUser", {
      type: AuthResponseData,
      async resolve(_, __, ctx: TContext) {
        if (!ctx.req.session.userId) {
          return {
            msg: "No session found",
            fields: [],
            success: false,
          };
        }

        ctx.req.session.destroy((err) => {
          if (err) {
            console.log(err);
            return;
          }
        });
        ctx.res.clearCookie(COOKIE_NAME);

        return {
          msg: "User logged out",
          fields: [],
          success: true,
        };
      },
    });
    // CREATE NEW POST
    t.field("CreatePost", {
      type: CreatePostResponseData,
      args: {
        title: nonNull(stringArg()),
        description: nullable(stringArg()),
      },
      async resolve(_, { title, description }, ctx: TContext) {
        if (!ctx.req.session.userId) {
          return {
            msg: "No Session found",
          };
        }

        if (title.length < 3) {
          return {
            msg: "Title must be atleast 3 characters long",
          };
        }

        const newPost = await ctx.db.post.create({
          data: {
            title,
            description,
            authorId: ctx.req.session.userId,
          },
        });

        return {
          data: newPost,
          msg: "Success",
        };
      },
    });
  },
});
