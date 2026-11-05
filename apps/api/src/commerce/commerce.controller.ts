import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import {
  type AddCartItemInput,
  addCartItemSchema,
  type ChargeInput,
  type CheckoutInput,
  chargeSchema,
  checkoutSchema,
} from "@raon/contracts";
import { AuthGuard, type AuthUser, CurrentUser, Roles } from "../auth/auth.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CommerceService } from "./commerce.service.js";

@Controller()
@UseGuards(AuthGuard)
@Roles("READER")
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get("cart")
  cart(@CurrentUser() user: AuthUser) {
    return this.commerce.getCart(user.id);
  }

  @Post("cart/items")
  add(@CurrentUser() user: AuthUser, @Body(new ZodPipe(addCartItemSchema)) body: AddCartItemInput) {
    return this.commerce.addToCart(user.id, body);
  }

  @Delete("cart/items/:itemId")
  remove(@CurrentUser() user: AuthUser, @Param("itemId", ParseUUIDPipe) itemId: string) {
    return this.commerce.removeFromCart(user.id, itemId);
  }

  @Post("orders")
  @HttpCode(200)
  checkout(@CurrentUser() user: AuthUser, @Body(new ZodPipe(checkoutSchema)) body: CheckoutInput) {
    return this.commerce.checkout(user.id, body.idempotencyKey);
  }

  @Get("library")
  library(@CurrentUser() user: AuthUser) {
    return this.commerce.getLibrary(user.id);
  }

  @Get("wallet")
  wallet(@CurrentUser() user: AuthUser) {
    return this.commerce.getWallet(user.id);
  }

  @Post("wallet/charge")
  @HttpCode(200)
  charge(@CurrentUser() user: AuthUser, @Body(new ZodPipe(chargeSchema)) body: ChargeInput) {
    return this.commerce.charge(user.id, body);
  }
}
