let username = document.getElementById('username')
let submit = document.getElementById('submit')
function checkInputs() {
    if (username.value == '') {
        submit.disabled = true;
    } else {
        submit.disabled = false;
    }
}

function submitForm() {
  document.getElementById('form').submit();
}

document.getElementById('submit').onclick = () => {
  setTimeout("submitForm()", 3000);
  let pbar = document.getElementById('pbar');
  let pbarStatus = 1;
  var timer = setInterval(() => {
    pbarStatus *= 1.15;
    pbar.style.width = pbarStatus.toString() + '%';
    if (pbarStatus >= 80) {
      clearInterval(timer);
    }
  }, 100);
  setInterval(() => {
    pbarStatus += 1.43;
    pbar.style.width = pbarStatus.toString() + '%';
    if (pbarStatus >= 100) {
      clearInterval(timer);
    }
  }, 100);
};
