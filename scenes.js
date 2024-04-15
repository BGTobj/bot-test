import { Markup, Scenes } from "telegraf";
import { message } from 'telegraf/filters'
import express from 'express'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
dotenv.config()
import { GoogleSpreadsheet } from'google-spreadsheet'
import { JWT } from 'google-auth-library'
import sqlite3  from 'sqlite3'
sqlite3.verbose();
import Mail from './mail.js'
const { CLIENT_EMAIL, EMAIL_HOST_USER } = process.env
const { privateKey } = JSON.parse(process.env.PRIVATE_KEY)
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
  ];
const serviceAccountAuth = new JWT({
    email: CLIENT_EMAIL,
    key: privateKey,
    scopes: SCOPES,
  });

const doc = new GoogleSpreadsheet(process.env.SPREADSHEETID, serviceAccountAuth);
//получение данных из google-sheets

const appMailer = express()
appMailer.use(bodyParser.json())

const db = new sqlite3.Database('./testBot.db');
let sql;
let userId;
let userCity;
let userDrugStoreId;
let userDrugStoreAdress;
let errorMsg;
const mainMenu = Markup
    .keyboard([
      'Акции и спецпредложения', 
      'Адреса и график работы аптек', 
      'Мои аптеки',
      'Оставить отзыв',
      'Задать вопрос'
    ])
    .oneTime()
    .resize()

const keyboardFavorite = Markup.inlineKeyboard(
    [Markup.button.callback('Добавить в избранное', 'insertFavorite'),
    Markup.button.callback('Удалить из избранного', 'deleteFavorite')],
    [Markup.button.callback('В главное меню', 'mainMenu')],
    ).oneTime().resize()

const fullRegions = [];
let regions = [];
let cities = [];
let idApt = [];
let adress = [];
let schedule = [];
let urlYm = [];
let arCity = [];
let arDrugStore = [];
const getInfo = async () => {
    await doc.loadInfo()
    const aptekiSheet = doc.sheetsByIndex[0];
    const rows = await aptekiSheet.getRows();
for (let key in rows) {
    fullRegions.push(rows[key].get('region'));
    cities.push(rows[key].get('city'))
    idApt.push(rows[key].get('id_apt'));
    adress.push(rows[key].get('adress'));
    schedule.push(rows[key].get('schedule'));
    urlYm.push(rows[key].get('urlYM'));
}
regions = Array.from(new Set(fullRegions));
}
getInfo();
const buttons = ['Поблагодарить нас', 'Предложить идеи для улучшения', 'Отзыв о работе аптеки/сотрудника', 'Отзыв о наших товарах', 'В главное меню'];
let userMessage = ''
let userEmail = 'Не указал'
let adressDrugStore = 'Не указал'
const backMainMenu = Markup.inlineKeyboard(
    [Markup.button.callback('В главное меню', 'mainMenu'),],
    )
// Handler factories
const { enter, leave } = Scenes.Stage;

class SceneGenerator {
    getPromoScene() {
        const promo = new Scenes.BaseScene("promo");
        promo.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regions).oneTime().resize(), {parse_mode: 'HTML'})
        });
        promo.on(message('text'), async ctx => {
            let regionPromo = [];
            let namePromo = [];
            let datePromo = [];
            const msg = ctx.message.text;
            const promoSheet = doc.sheetsByIndex[1];
            const rowsPromo = await promoSheet.getRows();
            let key;
            for (let row of rowsPromo) {
                namePromo.push(row.get('name'));
                datePromo.push(row.get('date'));
                regionPromo.push(row.get('region'));
            }
            for (key in regionPromo) {
                if(msg === regionPromo[key]) {
                    await ctx.reply(`${datePromo[key]} проходит акция ${namePromo[key]}, для уточнения подробностей акции переходите по <a href="https://monastirev.ru/promotions/">ссылке</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup});
                }
            }
            ctx.scene.leave()
        });
        promo.on("message", (ctx) => {
            ctx.reply("Вы не выбрали населенный пункт");
            ctx.scene.reenter()
        });
        return promo;
    }

    sendQuestionScene() {
        const sendQuestion = new Scenes.BaseScene("sendQuestion");
        sendQuestion.enter( (ctx) => {
            ctx.reply(`Для связи с оператором, вы будете перенаправлены в отдельный чат. Наши сотрудники помогут Вам и ответят на все вопросы\nДля продолжения нажмите ПЕРЕЙТИ`, 
                Markup.inlineKeyboard(
                    [Markup.button.url('Перейти', 'https://t.me/bgtobj'), Markup.button.callback('В главное меню', 'mainMenu'),],
                )
            )
            ctx.scene.leave()
        })
        sendQuestion.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        sendQuestion.on("message", (ctx) => {
            ctx.reply("Ошибка");
            ctx.scene.leave()
        })
        return sendQuestion;    
    }

    getCityScene() {
        const getCity = new Scenes.BaseScene("getCity");
        getCity.enter( (ctx) => {
            ctx.reply(`Выберите населенный пункт`, Markup.keyboard(regions).oneTime().resize(), {parse_mode: 'HTML'})
        })
        getCity.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            for (let i in fullRegions) {
                if (msg === fullRegions[i]) {
                    arCity.push(cities[i]);
                }
            }
            arCity = Array.from(new Set(arCity))
            ctx.scene.leave()
            ctx.scene.enter('getListDrugStore')
        })
        return getCity;
    }

    getListDrugStoreScene() {
        const getListDrugStore = new Scenes.BaseScene("getListDrugStore");
        getListDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите город`, Markup.keyboard(arCity).oneTime().resize(), {parse_mode: 'HTML'}) 
        })
        getListDrugStore.on(message('text'), async ctx  => {
            let msg = ctx.message.text;
            for (let i in fullRegions) {
                if (msg === cities[i]) {
                    arDrugStore.push(`Аптека №${idApt[i]} на ${adress[i]}`);
                    userCity = msg
                }
            }
            arCity.length = 0;
            ctx.scene.leave()
            ctx.scene.enter('getDrugStore')
        })
        return getListDrugStore;
    }

    getDrugStoreScene() {
        const getDrugStore = new Scenes.BaseScene("getDrugStore");
        getDrugStore.enter( (ctx) => {
            ctx.reply(`Выберите аптеку`, Markup.keyboard(arDrugStore).oneTime().resize(), {parse_mode: 'HTML'})
        })
        getDrugStore.on(message('text'), async ctx  => {
            userId = ctx.message.from.id;
            let msg = ctx.message.text;
            for (let i in fullRegions) {
                if (msg === `Аптека №${idApt[i]} на ${adress[i]}`) {
                    userDrugStoreId = idApt[i];
                    userDrugStoreAdress = adress[i];
                    await ctx.reply(`Аптека № ${idApt[i]} на ${adress[i]} г. ${cities[i]}, ${adress[i]}, режим работы ${schedule[i]}, <a href="${urlYm[i]}">как проехать</a>`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboardFavorite.reply_markup});
                        //ctx.scene.leave();
                        /* ctx.scene.enter('insertFavoriteDrugstore')
                        ctx.scene.enter('deleteFavoriteDrugstore') */
                }
            }
            arDrugStore.length = 0;
            //ctx.scene.leave();
        })
        getDrugStore.action('insertFavorite', (ctx) => {
            db.serialize(() => {
                db.get(`SELECT user_id FROM usersDrugstores WHERE user_id = ?`, [userId], (err, row) => {
                    if (err) {
                        return console.error(err.message)
                    }
                    if (row) {
                        ctx.scene.leave()
                        ctx.scene.enter('insertFavoriteDrugstore')
                    } else {
                        ctx.scene.leave()
                        ctx.scene.enter('getContact');
                    }
                });  
            })  
        })
        getDrugStore.action('deleteFavorite', (ctx) => {
            ctx.scene.leave()
            ctx.scene.enter('deleteFavoriteDrugstore');
        })
        return getDrugStore;
    }

    getContactScene() {
        const getContact = new Scenes.BaseScene("getContact");
        getContact.enter(async ctx => {
            ctx.reply(`Чтобы добавить аптеку в избранное необходимо поделиться номером телефона`, Markup.keyboard([Markup.button.contactRequest('Поделиться')]).oneTime().resize())
            ctx.reply(`Выйти в главное меню`, {reply_markup: backMainMenu.reply_markup})
        })
        getContact.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        getContact.on(message('contact'), async (ctx) => {
            ctx.scene.leave()
            ctx.scene.enter('insertFavoriteDrugstore')
        })
        return getContact;
    }

    insertFavoriteDrugstoreScene() {
        const insertFavoriteDrugstore = new Scenes.BaseScene("insertFavoriteDrugstore");
        insertFavoriteDrugstore.enter(async ctx => {
            let userFavoriteDrugstoreData = [];
            userFavoriteDrugstoreData.push(userDrugStoreId, userCity, userDrugStoreAdress, userId)
            db.serialize(() => {
                db.get(`SELECT id_apt, user_id FROM usersDrugstores WHERE id_apt = ? AND user_id = ?`, [userDrugStoreId, userId], (err, row) => {
                    if (err) {
                        return console.error(err.message)
                    }
                    if (row) {
                        errorMsg = `Вы уже добавили аптеку в избранное`
                        ctx.reply(errorMsg)
                        ctx.scene.leave()
                    } else {
                        sql = `INSERT INTO usersDrugstores(id_apt, cityOfDrugstore, adress, user_id) VALUES (?,?,?,?)`;
                        db.run(sql, userFavoriteDrugstoreData, (e) => {
                            if(e) {
                                return console.error(e.message)
                            }
                        });
                    }
                });
            })
            await ctx.reply(`Если у вас остались вопросы, то можете ознакомиться с полной информацией по ассортименту в МП (ссылка), на сайте (ссылка) или задать вопрос оператору (ссылка)`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup})
            ctx.scene.leave()
        })       
        return insertFavoriteDrugstore;
    }

    deleteFavoriteDrugstoreScene() {
        const deleteFavoriteDrugstore = new Scenes.BaseScene("deleteFavoriteDrugstore");
        deleteFavoriteDrugstore.enter(async (ctx) => {
            db.serialize(() => {
                db.get(`SELECT id_apt, user_id FROM usersDrugstores WHERE id_apt = ? AND user_id = ?`, [userDrugStoreId, userId], (err, row) => {
                    if (err) {
                        return console.error(err.message)
                    }
                    if (row) {
                        sql = `DELETE FROM usersDrugstores WHERE id_apt = ? AND user_id = ?`;
                        db.run(sql, [userDrugStoreId, userId], (e) => {
                            if(e) {
                                return console.error(e.message)
                            }
                            ctx.scene.leave()
                        });
                    } else {
                        ctx.reply(`Этой аптеки нет в избранном`);
                        ctx.scene.leave()
                    }
                });  
            })
            await ctx.reply(`Если у вас остались вопросы, то можете ознакомиться с полной информацией по ассортименту в МП (ссылка), на сайте (ссылка) или задать вопрос оператору (ссылка)`, {parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: backMainMenu.reply_markup})
            ctx.scene.leave()
        })
        return deleteFavoriteDrugstore;
    }

    myDrugStoresScene() {
        const myDrugStores = new Scenes.BaseScene("myDrugStores");
        myDrugStores.enter( (ctx) => {
            userId = ctx.message.from.id;
            let arUsersDrugstore = [];
            db.serialize(() => {
                sql = `SELECT id_apt, user_id, adress FROM usersDrugstores ORDER BY id_apt`
                db.all(sql, (err, rows) => {
                    if (err) {
                        return console.error(err.message)
                    }
                    rows.forEach((row) => {
                        if (row.user_id === userId) {
                            arUsersDrugstore.push(`Аптека №${row.id_apt} на ${row.adress}`)
                        }
                    });
                    if(arUsersDrugstore.length > 0) {
                        ctx.reply(`Ваши аптеки`, Markup.keyboard(arUsersDrugstore).oneTime().resize())
                        ctx.scene.enter('getDrugStore')
                    } else {
                        return ctx.reply(`Вы не добавили аптеку в избранное`, backMainMenu)
                    }
                  }); 
            })
            ctx.scene.leave()
        })
        
        return myDrugStores;
    }

    sendReviewScene() {
        const sendReview = new Scenes.BaseScene("sendReview");
        sendReview.enter((ctx) => {
            ctx.reply(`Выберите нужное`, Markup.keyboard(buttons).oneTime().resize(), {parse_mode: 'HTML'})
        })
        sendReview.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg === "Отзыв о работе аптеки/сотрудника") {
                ctx.scene.leave()
                ctx.scene.enter('getReviewMessageMan')
            } else if (msg === "В главное меню") {
                ctx.scene.leave()
                ctx.reply(`Выберите, что Вас интересует`, mainMenu)
            } else {
                for (let i in buttons) {
                    if (msg === buttons[i-1]) {
                        ctx.reply(`Напишите, пожалуйста, ваш вопрос`)
                    }
                }
                ctx.scene.leave()
                ctx.scene.enter('getReviewMessage')
            }  
        })
        return sendReview;
    }

    getReviewMessageManScene() {
        const getReviewMessageMan = new Scenes.BaseScene("getReviewMessageMan");
        getReviewMessageMan.enter((ctx) => {
            ctx.reply(`Укажите, пожалуйста, адрес аптеки в формате "улица дом"`)
        })
        getReviewMessageMan.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            for (let i in adress) {
                if (msg === adress[i]) {
                    adressDrugStore = msg
                } else {
                    ctx.scene.leave()
                }
            }
            ctx.reply(`Напишите, пожалуйста, ваш вопрос`)
            ctx.scene.leave()
            ctx.scene.enter('getReviewMessage')
        })
        return getReviewMessageMan;
    }

    getReviewMessageScene() {
        const getReviewMessage = new Scenes.BaseScene("getReviewMessage");
        getReviewMessage.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            if (msg.length === 0) {
                ctx.scene.reenter()
            } else {
                userMessage = msg;
                ctx.reply(`Укажите, пожалуйста, адрес вашей электронной почты, телефон если желаете получить ответ`, Markup.inlineKeyboard(
                    [Markup.button.callback('Пропустить', 'Check'),],
                    ))
                ctx.scene.leave()
                ctx.scene.enter('getUserEmail')
            }
        })
        return getReviewMessage;
    }

    getUserEmailScene() {
        const getUserEmail = new Scenes.BaseScene("getUserEmail");
        getUserEmail.action('Check', (ctx) => {
            ctx.reply(`Нажмите кнопку "отправить", чтобы отправить сообщение нам на почту`, Markup.inlineKeyboard(
                [Markup.button.callback('Отправить', 'Send'),],
                ))
                ctx.scene.leave()
                ctx.scene.enter('postReview')
            })
        getUserEmail.on(message('text'), async ctx => {
            let msg = ctx.message.text;
            userEmail = msg;
            ctx.reply(`Нажмите кнопку "отправить", чтобы отправить сообщение нам на почту`, Markup.inlineKeyboard(
                [Markup.button.callback('Отправить', 'Send'),],
                ))
                ctx.scene.leave()
                ctx.scene.enter('postReview')
            })
        return getUserEmail;
    }

    postReviewScene() {
        const postReview = new Scenes.BaseScene("postReview");
        postReview.action('Send', async (ctx) => {
            const data = `Адрес аптеки: ${adressDrugStore}\nПочта пользователя: ${userEmail}\nСообщение: ${userMessage}`
            Mail.send(EMAIL_HOST_USER, data)
            ctx.reply(`Ваш вопрос передан в отдел контроля качества. Мы отвечаем в течение 2-х дней, но постараемся сделать это быстрее. Не забудьте проверить вашу почту и папку спам. Спасибо, что помогаете нам развиваться!`, backMainMenu)
            ctx.scene.leave()
            //ctx.scene.enter('sendReview')
        })
        postReview.action('mainMenu', async ctx => {
            ctx.scene.leave()
            await ctx.reply(`Выберите, что Вас интересует`, mainMenu)
        })
        return postReview;
    }
}

export default SceneGenerator
