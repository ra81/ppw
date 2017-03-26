
/// <reference path= "../../_jsHelper/jsHelper/jsHelper.ts" />
/// <reference path= "../../XioPorted/PageParsers/2_IDictionary.ts" />
/// <reference path= "../../XioPorted/PageParsers/7_PageParserFunctions.ts" />
/// <reference path= "../../XioPorted/PageParsers/1_Exceptions.ts" />

$ = jQuery = jQuery.noConflict(true);
$xioDebug = true;
let Realm = getRealmOrError();
let CompanyId = getCompanyId();
let KeyCode = "ppw";        // доп ключик для создания уникального идентификатора для хранилища
let storageKey = buildStoreKey(Realm, KeyCode, getSubid());
let GameDate = parseGameDate(document, document.location.pathname);
interface IUnitData {
    dt: string;
    wk: number;
}
interface IPpwData {
    dateStr: string;
    finData: IFinRep;
}
interface IFinRep {
    employees: number|null;  // число рабов
    days: number;   // число дней усреднения. на новом юните 1-2 будет
    incomeTotal: number;
    expenseTotal: number;
    profitTotal: number;
    taxTotal: number;
}
interface ISortData {
    place: number;      // исходный номер строки в таблице
    subid: number;        // id юнита
    profit: number;       // прибыль юнита
    ppw: number;        // profit per worker
    $r: JQuery;         // ссыль на строку
}
enum Sort { none, asc, desc };

// упрощаем себе жисть, подставляем имя скрипта всегда в сообщении
function log(msg: string, ...args: any[]) {

    msg = "ppw: " + msg;
    logDebug(msg, args);
}

function Start() {

    logDebug("ppw: начали");


    //for (let k in localStorage) {
    //    if (k.indexOf("udt") > 0) {
    //        let it = localStorage[k] as string;
    //        if (it.indexOf("14.02") > 0)
    //            console.log(k + " " + localStorage[k]);
    //    }
    //}

    // выключено потому что надо переписать под новый интерфейс хранения данных. а вообще
    // в юните это смотреть особо нах не надо. поэтому до лучших времен
    //if (isUnitMain(document.location.pathname, document, true))
    //    unitMain();

    //if (isUnitFinanceReport())
    //    showProfitPerWorker();

    if (isCompanyRepByUnit())
        showPPWForAll()

    logDebug("ppw: закончили");
}

function unitMain() {

    let subid = getSubid();
    // сохраним в лок хранилище инфу по числу рабочих
    let parsedMain = parseUnitMain(document, document.location.pathname);
    let empl: IEmployeesNew = {
        empl: parsedMain.employees,
        subid: subid,
        eff: -1,
        emplMax: -1,
        holiday: false,
        qual: -1,
        qualRequired: -1,
        salary: -1,
        salaryCity: -1
    };

    let d: IDictionaryN<IEmployeesNew> = {};
    d[subid] = empl;
    saveEmplData(d);
}

function showProfitPerWorker() {
    // читаем данные с хранилища, если они там есть конечно
    let data = tryLoadPpw(storageKey);
    if (data == null) {
        logDebug("Дата данных устарела или данных нет.");
        return;
    }

    let $rows = $("table.treport").find("tr");
    let $turnoverRow = $rows.eq(1);
    let $profitRow = $rows.eq(3);
    $turnoverRow.add($profitRow).find("td").not(":first-child").each((i, e) => {
        let money = numberfy($(e).text());
        let ppw = (<IUnitData>data).wk > 0 ? Math.round(money / (<IUnitData>data).wk) : 0;
        let str = sayMoney(ppw, "$");
        $(`<br/><span>  (${str})</span>`).appendTo(e).css({ color: "gray" });
    });
}

function showPPWForAll() {
    let $grid = $("table.grid");

    // выводим кнопку обновления данных по рабам в подразделениях
    //
    let $ppwPanel = $(
        `<div id="ppwPanel">
            <table>
            <tbody>
                <tr><td>Прибыль на раба</td></tr>
                <tr><td>
                    <input id="ppwUpdate" type="button" value=" Обновить " style="display:inline-block"></input>
                    <input id="ppwClear" type="button" value=" Очистить " style="display:inline-block"></input>
                </td></tr>
                <tr><td id="errors" style="color:red;" colspan=2></td></tr>
            </tbody>
            </table>
        </div>`
    );
    let $updateBtn = $ppwPanel.find("#ppwUpdate");
    let $clearBtn = $ppwPanel.find("#ppwClear");
    let $err = $ppwPanel.find("#errors");
    let appendErr = (msg: string) => {
        if ($err.find("span").length > 0)
            $err.append("</br>");

        $err.append(`<span>${msg}</span>`);
    };
    let clearErr = () => $err.children().remove();

    $updateBtn.on("click", async (event) => {
        // обновим данные по рабам по всем юнитам. со страницы управления персоналом.
        // сделаем репейдж если надо, и перезагрузим страницу.
        $updateBtn.prop("disabled", true);
        clearErr();
        try {
            // парсим данные с текущей страницы. не берем напрямую, так как могут быть модифицированы и не спарсится
            let html = await tryGet_async(document.location.pathname);
            let rep = parseFinanceRepByUnits(html, document.location.pathname);

            // собираем данные по всем юнитам из отчета на текущей странице
            // записываем в хранилище и релоадим страницу, после этого данные будут отображены
            let finData = await getFinData_async(Object.keys(rep).map(v => parseInt(v)));
            savePpw(finData);
            document.location.reload();
        }
        catch (err) {
            appendErr("Не могу получить данные по работникам. => " + err);
            throw err;
        }
        finally {
            $updateBtn.prop("disabled", false);
        }
    });

    $clearBtn.on("click", event => {

        let removed = 0;
        for (let key in localStorage) {

            // если в ключе нет числа, не брать его
            let m = extractIntPositive(key);
            if (m == null)
                continue;

            // если ключик не совпадает со старым ключем для посетителей
            // на крайняк вводим проверку на нул. Лучше здесь перебдеть а то удалит нах не то
            let subid = m[0];
            if (subid == null)
                throw new Error(`subid не спарсился с ключа ${key}`);

            if (key !== buildStoreKey(Realm, KeyCode, subid))
                continue;

            // ключик точно наш
            localStorage.removeItem(key);
            removed++;
        }

        log("удалено " + removed);
    });

    drawPpw();

    function drawPpw() {
        // теперь собсна отрисуем то что есть у нас сохраненное в хранилище
        //
        $grid.before($ppwPanel);

        let $th = $grid.find("th:contains('Прибыль')");
        let profitInd = $th.index();
        let $clone = $th.clone();

        $clone.css("cursor", "pointer");
        $clone.find("td.title-ordertool").text("ppw");
        let $asc = $clone.find("a[href*=asc]").prop("id", "ppwasc").attr("href", "#");
        let $desc = $clone.find("a[href*=desc]").prop("id", "ppwdesc").attr("href", "#");
        $clone.on("click", (event) => {

            let el = $(event.target);
            if ($clone.hasClass("asc")) {
                $clone.removeClass("asc");
                sort_table(Sort.none);
            }
            else if ($clone.hasClass("desc")) {
                $clone.removeClass("desc");
                $clone.addClass("asc");
                sort_table(Sort.asc);
            }
            else {
                $clone.addClass("desc");
                sort_table(Sort.desc);
            }

            console.log("clicked");
            return false;
        });

        $clone.insertAfter($th);

        // сначала мы как бы спарсим данные по каждой строке то есть по юнитам
        let $rows = closestByTagName($grid.find("img[src*='unit_types']"), "tr");
        let subInd = $grid.find("th:contains('Предприятие')").index();
        let data = parseRows($rows,
            ($r) => {
                let $a = $r.children("td").eq(subInd).find("a");
                let n = extractIntPositive($a.attr("href"));
                if (n == null)
                    throw new Error("не смог определить subid для $a.attr('href')");

                return n[0];
            },
            ($r) => numberfy($r.children("td").eq(profitInd).text())
        );

        if (data.length != $rows.length)
            throw new Error("не знаю что но что то пошло не так. число данных не равно числу строк");

        // теперь нам бы надо считать по всем юнитам дату что хранится в локальном хранилище
        // и вывести все
        let subids = data.map(v => v.subid);
        let ppwLoaded = loadPpw(subids);

        data.forEach((val, i, arr) => {
            let ppw = ppwLoaded[val.subid];

            // в каждую ячейку добавим инфу за Х дней и цифру сколько дней есть.
            // если данных нет, просто оставим как есть и добавим пустую ячейку для ppw
            let htmlTpl = `<span style="display:block; color:orange; font-size:10px;">{0}</span>
                           <span style="display:block; color:gray; font-size:10px;">{1}</span>`;
            if (ppw != null) {
                // доход
                let html = formatStr(htmlTpl, ppw.employees == null ? 0 : sayMoney(Math.round(ppw.incomeTotal / ppw.employees)), sayMoney(Math.round(ppw.incomeTotal)));
                arr[i].$r.children("td").eq(4).append(html);

                // расход
                html = formatStr(htmlTpl, ppw.employees == null ? 0 : sayMoney(Math.round(ppw.expenseTotal / ppw.employees)), sayMoney(Math.round(ppw.expenseTotal)));
                arr[i].$r.children("td").eq(5).append(html);

                // налог
                html = formatStr(htmlTpl, ppw.employees == null ? 0 : sayMoney(Math.round(ppw.taxTotal / ppw.employees)), sayMoney(Math.round(ppw.taxTotal)));
                arr[i].$r.children("td").eq(6).append(html);

                //  прибыль
                html = formatStr(htmlTpl, ppw.employees == null ? 0 : sayMoney(Math.round(ppw.profitTotal / ppw.employees)), sayMoney(Math.round(ppw.profitTotal)));
                arr[i].$r.children("td").eq(7).append(html);

                // запишем для сортировки цифру
                arr[i].ppw = ppw.employees > 0 ? Math.round(ppw.profitTotal / (ppw.employees * ppw.days)) : 0;

                // ячейки добавим
                $(`<td class='nowrap' align='right'>
                    <span style="display:block;">${sayMoney(arr[i].ppw)}</span>
                    <span style="display:block; color:gray; font-size:10px;">${ppw.employees == null ? 0 : ppw.employees} рабов</span>
                    <span style="display:block; color:gray; font-size:10px;">${ppw.days} дней</span>
                </td>`).insertAfter(arr[i].$r.children("td").eq(profitInd));
            }
            else {
                $(`<td class='nowrap' align='right'>
                    <span style="display:block;">$0</span>
                </td>`).insertAfter(arr[i].$r.children("td").eq(profitInd));
            }


        });

        function sort_table(type: Sort) {

            let $start = $grid.find("tbody tr").first();
            let sorted = sortData(data, type);  // исходные тоже меняется

            // вставлять будем задом наперед. Просто начиная с шапки таблицы вставляем в самый верх
            // сначала идут последние постепенно дойдем до первых. Самый быстрый способ вышел
            let odd = false;
            for (let i = sorted.length - 1; i >= 0; i--) {
                let $r0 = sorted[i].$r;
                $r0.removeClass('even odd').addClass(odd ? 'odd' : 'even');
                $r0.insertAfter($start);

                odd = odd ? false : true;
            }
        }
    }
}

/**
 * Собирает инфу по указанному списку юнитов
 */
async function getFinData_async(subids: number[]): Promise<IDictionaryN<IFinRep>> {
    if (subids == null)
        throw new Error("subids == null");

    // подбираем сводную инфу по числу рабов в магазинах через общий отчет по персоналу
    // и собираем финансовые данные по каждому юниту
    let emplDict = await getEmployees();
    let finDict = await getUnitsFin(subids);

    // теперь выделяем среднее за 4 дня, суммарное за 4 дня. И на раба среднее и суммарное.
    // считать будем все поля, хотя интересно только доходо и выручка.
    // после парсинга у нас либо 0 элементов если юнит новый либо 4 если не новый.
    // всегда у юнита сегодня есть расходы. нет юнитов без расходов. в прошлом расходов
    // может и не быть ведь юнит мог быть создан вчера. тогда прошлое идет нулями
    let res: IDictionaryN<IFinRep> = {};
    for (let subid of subids) {
        let data = finDict[subid];

        // находим суммарные финансовые показатели за доступное число дней
        let [inc, exp, prof, tax, days] = [0, 0, 0, 0, 0];
        for (let item of data) {
            if (item[1].expense === 0 && item[1].income === 0 && item[1].profit === 0 && item[1].tax === 0)
                continue;

            days++;
            inc += item[1].income;
            exp += item[1].expense;
            prof += item[1].profit;
            tax += item[1].tax;
        }

        // есть же юниты и без рабов, для них 0 рабов
        res[subid] = {
            employees: emplDict[subid] == null ? null : emplDict[subid].empl,
            days: days,
            incomeTotal: inc,
            expenseTotal: exp,
            profitTotal: prof,
            taxTotal: tax
        };
    }

    return res;


    async function getEmployees() {
        let url = `/${Realm}/main/company/view/${CompanyId}/unit_list/employee`;
        await tryGet_async(`/${Realm}/main/common/util/setpaging/dbunit/unitListWithHoliday/20000`);
        let html = await tryGet_async(url);
        await tryGet_async(`/${Realm}/main/common/util/setpaging/dbunit/unitListWithHoliday/100`);

        let emplDict = parseManageEmployees(html, url);
        if (Object.keys(emplDict).length < 2)
            throw new Error(`число юнитов со страницы персонала вышло 0, что невозможно`);

        return emplDict;
    }

    async function getUnitsFin(subids: number[]) {
        let finDict: IDictionaryN<[Date, IUnitFinance][]> = {};

        for (let subid of subids) {
            let url = `/${Realm}/main/unit/view/${subid}/finans_report`;
            let html = await tryGet_async(url);
            let parsed = parseUnitFinRep(html, url);
            finDict[subid] = parsed;
        }

        return finDict;
    }
}

function savePpw(ppw: IDictionaryN<IFinRep>) {
    let dateStr = dateToShort(GameDate);
    for (let key in ppw) {
        let subid = parseInt(key);
        let item = ppw[subid];
        let data: IPpwData = {
            dateStr: dateStr,
            finData: item
        };

        let storeKey = buildStoreKey(Realm, KeyCode, subid);
        localStorage[storeKey] = JSON.stringify(data);
    }
}

function loadPpw(subids: number[]): IDictionaryN<IFinRep> {
    let dict: IDictionaryN<IFinRep> = {};
    for (let subid of subids) {
        let storageKey = buildStoreKey(Realm, KeyCode, subid);
        let rawPpw = localStorage.getItem(storageKey);
        if (rawPpw == null)
            continue;

        // если дата записи не сегодня, значит данных еще нет
        let parsedPpw = JSON.parse(rawPpw) as IPpwData;
        if (parsedPpw.dateStr != dateToShort(GameDate))
            continue;

        dict[subid] = parsedPpw.finData;
    }

    return dict;
}



// загружает и парсит данные о рабах в юнитах со страницы управления персоналом
function getEmployees(): JQueryPromise<IDictionaryN<IEmployeesNew>> {

    let deffered = $.Deferred();

    //if (1) {
    //    deffered.reject("пизда пришла всему");
    //    return deffered.promise();
    //}

    let urlEmpl = `/${Realm}/main/company/view/${CompanyId}/unit_list/employee`;
    getPage(urlEmpl)
        .then((html) => {
            // парсинг
            try {
                if (html == null)
                    throw new Error("Страница не прочитана " + urlEmpl);

                let empl = parseManageEmployees(html, urlEmpl);
                if (Object.keys(empl).length === 0)
                    throw new Error("Число юнитов с рабами 0. Невозможно"); 

                deffered.resolve(empl);
            }
            catch (err) {
                let e = (err as Error);
                deffered.reject(e.message);
                log("ошибка: ", e);
            }
        })
        .fail((err) => {
            deffered.reject(`Не смог загрузить ${urlEmpl} => ` + err);
        });


    return deffered.promise();
}

function saveEmplData(empl: IDictionaryN<IEmployeesNew>) {
    //debugger;
    let dateStr = dateToShort(GameDate);
    for (let key in empl) {
        let item = empl[key];
        let udt: IUnitData = {
            dt: dateStr,
            wk: item.empl
        };

        let storeKey = buildStoreKey(Realm, KeyCode, item.subid);
        localStorage[storeKey] = JSON.stringify(udt);
    }
}

function tryLoadPpw(key: string): IUnitData | null {
    // читаем данные с хранилища, если они там есть конечно
    let keys = Object.keys(localStorage);
    let rawData = localStorage.getItem(key);
    if (rawData == null)
        return null;

    let data = JSON.parse(<string>rawData) as IUnitData;
    if (data.dt != dateToShort(GameDate))
        return null;

    return data;
}

function getSubid() {
    let numbers = extractIntPositive(document.location.pathname);
    if (numbers == null || numbers.length < 1)
        throw new Error("Не смогли спарсить subid юнита со ссылки");

    return numbers[0];
}

function parseRows($rows: JQuery, subidSelector: ($r: JQuery) => number, profitSelector: ($r: JQuery) => number): ISortData[] {

    let res: ISortData[] = [];

    for (let i = 0; i < $rows.length; i++) {
        let $r = $rows.eq(i);

        let subid = subidSelector($r); 
        let profit = profitSelector($r);

        res.push({
            place: i,
            subid: subid,
            profit: profit,
            ppw: 0,
            $r: $r
        });
    }

    return res;
}

function sortData(items: ISortData[], type: Sort): ISortData[] {
    switch (type) {
        case Sort.asc:
            items.sort((a, b) => {
                if (a.ppw > b.ppw)
                    return 1;

                if (a.ppw < b.ppw)
                    return -1;

                return 0;
            });
            break;

        case Sort.desc:
            items.sort((a, b) => {
                if (a.ppw > b.ppw)
                    return -1;

                if (a.ppw < b.ppw)
                    return 1;

                return 0;
            });
            break;

        case Sort.none:
            items.sort((a, b) => {
                if (a.place > b.place)
                    return 1;

                if (a.place < b.place)
                    return -1;

                return 0;
            });
    }

    return items;
}

$(document).ready(() => Start());