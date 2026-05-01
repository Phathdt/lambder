@products
Feature: Products CRUD
  As an authenticated user
  I want to manage my products
  So that the catalogue stays up to date

  Background:
    Given a fresh user is signed in

  @smoke
  Scenario: Owner adds a new product and sees it in the list
    When I add a new random product
    Then I should see that product in the list

  Scenario: Client-side zod schema rejects an invalid price
    When I try to submit a product with price "not-a-number"
    Then I should see a price validation error
