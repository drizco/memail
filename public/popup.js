const EmailController = class EmailController {
  constructor() {
    this.settings = false;
    this.data = {
      url: '',
      title: '',
      email: ''
    };
  }

  getEmail() {
    const emailPromise = new Promise(resolve => {
      chrome.identity.getProfileUserInfo(user => {
        const email = user.email;
        this.setEmail = email;
        resolve(email);
      });
    });
    return emailPromise;
  }

  set setEmail(email) {
    this.data.email = email;
  }

  getTab() {
    const tabPromise = new Promise(resolve => {
      const config = {
        active: true,
        currentWindow: true
      };
      chrome.tabs.query(config, tabs => {
        const tab = tabs[0];
        this.data.url = tab.url;
        this.data.title = tab.title;
        resolve(tab);
      });
    });
    return tabPromise;
  }

  sendEmail(done) {
    fetch('https://us-central1-memail-163415.cloudfunctions.net/sendMeMail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=UTF-8' },
      body: JSON.stringify(this.data)
    })
      .then(response => response.text())
      .then(responseText => done(responseText))
      .catch(() => done('error'));
  }

  renderSettings(email) {
    const msgContainer = document.getElementById('msg-container'),
      fragment = document.createDocumentFragment(),
      label = document.createElement('label'),
      labelText = document.createTextNode('Your email is saved as:'),
      input = document.createElement('input'),
      button = document.createElement('button'),
      buttonText = document.createTextNode('UPDATE');

    label.appendChild(labelText);
    button.appendChild(buttonText);
    input.value = email;
    input.setAttribute('tabindex', '-1');
    input.onchange = function (event) {
      input.value = event.target.value;
    };

    const self = this;
    const renderSending = this.renderSending.bind(this);
    const sendEmail = this.sendEmail.bind(this);
    const renderStatus = this.renderStatus.bind(this);
    button.addEventListener('click', function (event) {
      event.preventDefault();
      const store = localStorage;
      store.setItem('email', input.value);
      self.setEmail = input.value;
      self.settings = false;
      renderSending(input.value);
      sendEmail(renderStatus);
    });
    [label, input, button].forEach(el => {
      el.className = 'animate';
      if (el === button) {
        el.className += ' shadow';
      }
    });
    fragment.appendChild(label);
    fragment.appendChild(input);
    fragment.appendChild(button);

    msgContainer.innerHTML = null;
    msgContainer.appendChild(fragment);
  }

  renderSending(email) {
    const msgContainer = document.getElementById('msg-container'),
      fragment = document.createDocumentFragment(),
      mainEl = document.createElement('div'),
      mainText = document.createTextNode('Sending'),
      titleEl = document.createElement('div'),
      titleText = document.createTextNode(this.data.title),
      toEl = document.createElement('div'),
      toText = document.createTextNode('to '),
      emailEl = document.createElement('span'),
      emailText = document.createTextNode(email);

    mainEl.appendChild(mainText);
    titleEl.appendChild(titleText);
    toEl.appendChild(toText);
    emailEl.appendChild(emailText);

    for (let i = 1; i <= 3; i++) {
      let dotText = document.createTextNode('.'),
        dotEl = document.createElement('span');
      dotEl.appendChild(dotText);
      dotEl.setAttribute('class', `dot dot-${i}`);
      mainEl.appendChild(dotEl);
    }

    toEl.appendChild(emailEl);

    fragment.appendChild(mainEl);
    fragment.appendChild(titleEl);
    fragment.appendChild(toEl);
    msgContainer.innerHTML = null;
    msgContainer.appendChild(fragment);
  }

  renderStatus(response) {
    if (this.settings) return;
    const msgContainer = document.getElementById('msg-container'),
      status = document.createElement('div'),
      success = 'MEmail sent!',
      error = 'uh oh, something went wrong...',
      statusMessage = response === 'success' ? success : error,
      statusText = document.createTextNode(statusMessage);
    status.className = 'status animate';
    status.appendChild(statusText);
    msgContainer.innerHTML = null;
    msgContainer.appendChild(status);
    setTimeout(window.close, 1000);
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const cog = document.getElementById('cog'),
    store = localStorage,
    MEmail = new EmailController();

  cog.addEventListener('click', function (event) {
    event.preventDefault();
    MEmail.settings = true;
    const storedEmail = store.getItem('email');
    if (storedEmail) {
      MEmail.renderSettings(storedEmail);
    } else {
      MEmail.getEmail().then(fetchedEmail => {
        MEmail.renderSettings(fetchedEmail);
      });
    }
  });

  MEmail.getTab().then(() => {
    const storedEmail = store.getItem('email');
    if (storedEmail) {
      MEmail.setEmail = storedEmail;
      MEmail.renderSending(storedEmail);
      const renderStatus = MEmail.renderStatus.bind(MEmail);
      setTimeout(() => {
        if (!MEmail.settings) {
          MEmail.sendEmail(renderStatus);
        }
      }, 500);
    } else {
      MEmail.getEmail().then(fetchedEmail => {
        MEmail.renderSettings(fetchedEmail);
      });
    }
  });
});
