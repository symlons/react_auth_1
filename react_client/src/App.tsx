import React from 'react';
import './App.css';
//
import { useState } from 'react';
import { response } from 'express';

interface User {
  email: string | undefined;
  password: string | undefined;
}

function App() {
  const [user, setUser] = useState<User>({
    email: undefined,
    password: undefined
  });

  const [invalid_credentials, setInvalid_credentials] = useState(false);
  const [invalid_email, setInvalid_email] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { target } = e;
    const name = target.name;
    const value = target.value;
    user[name as keyof User] = value;
    const regex =
      /^(([^<>()[\]\.,;:\s@\"]+(\.[^<>()[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;

    if (typeof user.email === 'string') {
      if (regex.test(user.email) === false) {
        setInvalid_email(true);
      } else {
        setInvalid_email(false);
      }
    }
    setUser(user);
  }

  async function loginrequest() {
    let response, csrf_response;
    let body;
    csrf_response = await fetch('api/csrf', {
      method: 'GET', // same origin is default
      headers: {
        'Content-Type': 'application/json'
      }
    });

    body = await csrf_response.json();

    response = await fetch('api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': body.csrfToken
      },
      body: JSON.stringify(user)
    });

    body = await response.json();
    console.log(body.message);
    console.log(response.status);
    if (response.status == 200) {
      setInvalid_credentials(false);
    } else {
      setInvalid_credentials(true);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (user.email === undefined) {
      setInvalid_email(true);
    } else if (user.password === undefined || user.password === '') {
      // password should be validated with regex like email
      setInvalid_credentials(true);
    } else if (invalid_email === false) {
      await loginrequest();
    }
  }

  async function handle_gauth() {
    async function get_state() {
      const response = await fetch('api/state', {
        method: 'GET', // same origin is default
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const state = await response.json();
      return state;
    }

    async function get_nonce() {
      const response = await fetch('api/nonce', {
        method: 'GET',
        headers: {
          'Content-Type': 'applicaton/json'
        }
      });
      const nonce = await response.json();
      return nonce;
    }

    async function gauth_get(state: string, nonce: string) {
      window.location.replace(
        'https://accounts.google.com/o/oauth2/v2/auth?' +
          new URLSearchParams({
            client_id:
              'your_google_clientid',
            response_type: 'code',
            scope: 'openid',
            redirect_uri: 'https://127.0.0.1:443/gauth',
            state: state,
            nonce: nonce // doesn't seem necessary with auth code
          })
      );
    }

    const state = await get_state();
    const nonce = await get_nonce();
    const gauth_response = await gauth_get(state, nonce);
    console.log(gauth_response);
  }

  return (
    <div className="min-w-screen min-h-screen overflow-hidden dark:bg-dark_gray1">
      <div className="relative left-60 h-full w-full max-w-xs py-10">
        <form
          onSubmit={handleSubmit}
          className="mb-4 rounded bg-white px-8 pt-6 pb-8 shadow-[0_4px_6px_4px_rgba(0,0,0,0.1)] dark:border  dark:border-dark_gray3 dark:bg-dark_gray2"
        >
          <div className="mb-4 mt-5">
            <label
              className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200"
              htmlFor="username"
            >
              Email
            </label>
            <input
              name="email"
              onChange={handleChange}
              className={`${
                invalid_credentials || invalid_email
                  ? 'border-red-500 dark:border-dark_red'
                  : 'border-gray-700'
              } mb-3 w-full appearance-none rounded border-2 py-2 px-3 leading-tight text-gray-700 outline-none  dark:bg-dark_gray3 dark:text-gray-200`}
              id="email"
              type="text"
              placeholder="email"
            />
            <p
              className={`transition-opacity duration-150 ease-in ${
                invalid_email ? 'opacity-1' : 'opacity-0'
              } text-xs italic text-red-500 dark:text-dark_red`}
            >
              Please enter a valid email.
            </p>
          </div>
          <div className="mb-12">
            <label
              className="mb-2 block text-sm font-bold text-gray-700 dark:text-gray-200"
              htmlFor="password"
            >
              Password
            </label>
            <input
              name="password"
              onChange={handleChange}
              className={`${
                invalid_credentials
                  ? 'border-red-500 dark:border-dark_red'
                  : 'border-gray-700'
              } mb-3 w-full appearance-none rounded border-2 py-2 px-3 leading-tight text-gray-700 shadow outline-none  dark:bg-dark_gray3 dark:text-gray-200`}
              id="password"
              type="password"
              placeholder="******************"
            />
            <div className="m-auto">
              <button onClick={handleSubmit}> Sing in</button>
            </div>
            <p
              className={`${
                invalid_credentials ? 'opacity-1' : 'opacity-0'
              } absolute left-1/4 mb-4 mt-4  text-sm font-bold text-red-500 dark:text-dark_red`}
            >
              invalid email or password
            </p>
          </div>
          <div className="flex items-center justify-between">
            <button className="rounded border-2 border-black bg-white py-2 px-4 font-bold hover:bg-black hover:text-white dark:border-dark_gray3 dark:bg-dark_gray3 dark:text-gray-200 dark:hover:bg-gray-200 dark:hover:text-black">
              Sign In
            </button>
            <a
              className="inline-block border-blue-700 align-baseline text-sm  font-bold hover:text-blue-700 dark:text-gray-200 dark:hover:text-blue-400
                "
            >
              Forgot Password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
