@auth
Feature: Authentication flow
  As a Lambder user
  I want to sign up and log in
  So that I can manage my products

  @smoke
  Scenario: New user signs up and lands on the products page
    Given I navigate to the signup page
    When I submit valid signup credentials
    Then I should be redirected to the products page

  Scenario: Signed-in user can sign out
    Given a fresh user is signed in
    When I click the sign out button
    Then I should be redirected to the login page
    And visiting the products page should redirect me to the login page

  Scenario: Login with wrong password shows an error toast
    Given a fresh user has signed up and signed out
    When I submit my email with the wrong password
    Then I should see an "invalid email or password" error
